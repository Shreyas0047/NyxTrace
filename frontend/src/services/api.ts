import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type {
  User, LoginCredentials, Investigation, Evidence, Alert,
  SandboxSession, TelemetryAnalysisResult, InvestigationSummary,
  ApiResponse, PaginationParams, DashboardStats,
  BehavioralPattern, ProcessBehavior, Anomaly,
  InvestigationCluster, InvestigationRelationship, CorrelationInsight,
  AnalyticsDashboardData, ComprehensiveForensicReport,
  SessionForensicAnalysis, SessionComparison,
  ThreatIntelAnalysis
} from '../types';
import type {
  BlockchainStatus, VerificationStats, VerificationResult,
  BatchVerificationResult, PackageVerificationResult,
  BlockchainAuditEntry, EvidenceIntegrityRecord, TamperAlert,
  HashGenerationResult, HashVerificationResult
} from '../types/blockchain';
import type {
  ForensicReportSummary, ForensicReportDetail, LogEntry,
  AppSettings, EvidenceArtifact, ForensicEvidenceDetail
} from '../types/reports';
import { config } from '../config';

const API_BASE_URL = config.env.apiUrl;

function normalizeEntity<T extends Record<string, any>>(entity: T): T {
  if (!entity) return entity;
  return {
    ...entity,
    id: entity.id || entity._id,
  };
}

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

// Service connectivity state
let _backendDown = false;
const SERVICE_DOWN_EVENT = 'forensics:service_down';
const SERVICE_UP_EVENT = 'forensics:service_up';

export function isBackendDown(): boolean {
  return _backendDown;
}

function setBackendStatus(down: boolean) {
  if (_backendDown === down) return;
  _backendDown = down;
  window.dispatchEvent(new CustomEvent(down ? SERVICE_DOWN_EVENT : SERVICE_UP_EVENT));
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a short correlation ID for end-to-end request tracing.
 * Uses crypto.randomUUID where available, falls back to a Math.random hex.
 */
function generateCorrelationId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // ignore — fall through to fallback
  }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

class ApiService {
  private client: AxiosInstance;
  private maxRetries = config.api.maxRetries;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: config.api.requestTimeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth token
    this.client.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
      const token = localStorage.getItem('accessToken');
      if (token && token !== 'null' && token !== 'undefined') {
        cfg.headers.Authorization = `Bearer ${token}`;
      }
      // Tag every outbound request with a correlation ID so it can be
      // traced end-to-end across frontend, backend, and sandbox agent logs.
      if (!cfg.headers['X-Correlation-ID']) {
        cfg.headers['X-Correlation-ID'] = generateCorrelationId();
      }
      return cfg;
    });

    // Response interceptor — retry on network errors, track connectivity
    this.client.interceptors.response.use(
      (response) => {
        setBackendStatus(false);
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

        // Network error or 5xx — retry with backoff (skip auth refresh path)
        const isNetworkError = !error.response && (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || error.message === 'Network Error');
        const isServerError = error.response && error.response.status >= 500;

        if ((isNetworkError || isServerError) && !originalRequest._retry) {
          const retryCount = originalRequest._retryCount || 0;
          if (retryCount < this.maxRetries) {
            originalRequest._retryCount = retryCount + 1;
            await delay(1000 * (retryCount + 1)); // 1s, 2s backoff
            return this.client(originalRequest);
          }
          // All retries exhausted
          if (isNetworkError) {
            setBackendStatus(true);
            return Promise.reject(new Error('Backend service is unreachable. Please check that the server is running.'));
          }
        }

        // 401 — token refresh logic
        if (error.response?.status !== 401 || originalRequest._retry) {
          return Promise.reject(error);
        }

        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(error);
        }

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.client(originalRequest);
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          const newAccessToken = response.data?.data?.tokens?.accessToken;
          const newRefreshToken = response.data?.data?.tokens?.refreshToken;

          if (newAccessToken) {
            localStorage.setItem('accessToken', newAccessToken);
          }
          if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
          }

          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return this.client(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
    );
  }

  // Auth
  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: User; tokens: { accessToken: string; refreshToken: string } }>> {
    const response = await this.client.post('/auth/login', credentials);
    const accessToken = response.data?.data?.tokens?.accessToken;
    const refreshToken = response.data?.data?.tokens?.refreshToken;
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
    }
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    return response.data;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async forgotPassword(email: string): Promise<ApiResponse<{ devOtp?: string }>> {
    const response = await this.client.post('/auth/forgot-password', { email });
    return response.data;
  }

  async verifyResetOtp(email: string, otp: string): Promise<ApiResponse<{ verified: boolean; passwordResetToken: string }>> {
    const response = await this.client.post('/auth/verify-reset-otp', { email, otp });
    return response.data;
  }

  async resetPassword(email: string, password: string, confirmPassword: string, token: string): Promise<ApiResponse<void>> {
    const response = await this.client.post('/auth/reset-password', { email, password, confirmPassword, token });
    return response.data;
  }

  // Dashboard - Use analytics dashboard endpoint
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    const response = await this.client.get('/analytics/dashboard');
    return response.data;
  }

  // Investigations
  async getInvestigations(params: PaginationParams): Promise<ApiResponse<Investigation[]>> {
    const response = await this.client.get('/investigations', { params });
    const raw = response.data;
    if (Array.isArray(raw?.data)) raw.data = raw.data.map(normalizeEntity);
    return raw;
  }

  async getInvestigation(id: string): Promise<ApiResponse<Investigation>> {
    const response = await this.client.get(`/investigations/${id}`);
    const raw = response.data;
    if (raw?.data?.investigation) {
      raw.data = raw.data.investigation;
    }
    if (raw?.data) raw.data = normalizeEntity(raw.data);
    return raw;
  }

  async createInvestigation(data: Partial<Investigation>): Promise<ApiResponse<Investigation>> {
    const response = await this.client.post('/investigations', data);
    const raw = response.data;
    if (raw?.data?.investigation) {
      raw.data = raw.data.investigation;
    }
    if (raw?.data) raw.data = normalizeEntity(raw.data);
    return raw;
  }

  async updateInvestigation(id: string, data: Partial<Investigation>): Promise<ApiResponse<Investigation>> {
    const response = await this.client.put(`/investigations/${id}`, data);
    const raw = response.data;
    if (raw?.data?.investigation) {
      raw.data = raw.data.investigation;
    }
    if (raw?.data) raw.data = normalizeEntity(raw.data);
    return raw;
  }

  async deleteInvestigation(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/investigations/${id}`);
    return response.data;
  }

  // Evidence
  async getEvidence(params: PaginationParams): Promise<ApiResponse<Evidence[]>> {
    const response = await this.client.get('/evidence', { params });
    const raw = response.data;
    if (Array.isArray(raw?.data)) raw.data = raw.data.map(normalizeEntity);
    return raw;
  }

  async getEvidenceByInvestigation(investigationId: string, params: PaginationParams): Promise<ApiResponse<Evidence[]>> {
    const response = await this.client.get(`/evidence/investigation/${investigationId}`, { params });
    const raw = response.data;
    if (Array.isArray(raw?.data)) raw.data = raw.data.map(normalizeEntity);
    return raw;
  }

  async getEvidenceById(id: string): Promise<ApiResponse<Evidence>> {
    const response = await this.client.get(`/evidence/${id}`);
    const raw = response.data;
    if (raw?.data?.evidence) raw.data = raw.data.evidence;
    if (raw?.data) raw.data = normalizeEntity(raw.data);
    return raw;
  }

  async uploadEvidence(formData: FormData): Promise<ApiResponse<Evidence>> {
    const response = await this.client.post('/evidence/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const raw = response.data;
    if (raw?.data?.evidence) raw.data = raw.data.evidence;
    if (raw?.data) raw.data = normalizeEntity(raw.data);
    return raw;
  }

  async verifyEvidence(id: string): Promise<ApiResponse<{ verified: boolean }>> {
    const response = await this.client.post(`/evidence/${id}/verify`);
    return response.data;
  }

  async deleteEvidence(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/evidence/${id}`);
    return response.data;
  }

  // Alerts
  async getAlerts(params: PaginationParams): Promise<ApiResponse<Alert[]>> {
    const response = await this.client.get('/alerts', { params });
    const raw = response.data;
    if (Array.isArray(raw?.data)) {
      raw.data = raw.data.map(normalizeEntity);
    }
    return raw;
  }

  async getAlert(id: string): Promise<ApiResponse<Alert>> {
    const response = await this.client.get(`/alerts/${id}`);
    const raw = response.data;
    if (raw?.data?.alert) raw.data = raw.data.alert;
    if (raw?.data) raw.data = normalizeEntity(raw.data);
    return raw;
  }

  async acknowledgeAlert(id: string): Promise<ApiResponse<Alert>> {
    const response = await this.client.post(`/alerts/${id}/acknowledge`);
    const raw = response.data;
    if (raw?.data?.alert) raw.data = raw.data.alert;
    if (raw?.data) raw.data = normalizeEntity(raw.data);
    return raw;
  }

  async resolveAlert(id: string, resolution: Record<string, unknown>): Promise<ApiResponse<Alert>> {
    const response = await this.client.post(`/alerts/${id}/resolve`, resolution);
    const raw = response.data;
    if (raw?.data?.alert) raw.data = raw.data.alert;
    if (raw?.data) raw.data = normalizeEntity(raw.data);
    return raw;
  }

  // Sandbox Runtime
  async getSandboxHealth(): Promise<ApiResponse<{ health: { status: string; version: string; uptime_seconds: number; vm_status: Record<string, any>; active_sessions: number; telemetry_connections: number } }>> {
    const response = await this.client.get('/sandbox/health');
    return response.data;
  }

  async getSandboxSimulators(): Promise<ApiResponse<{ simulators: Array<{ id: string; display_name: string; description: string; category: string }> }>> {
    const response = await this.client.get('/sandbox/simulators');
    return response.data;
  }

  async startSandboxSession(request: {
    simulator_id: string;
    auto_rollback?: boolean;
    timeout_seconds?: number;
  }): Promise<ApiResponse<{ session: { session_id: string; state: string; simulator_id: string; created_at: string; updated_at: string; error?: string } }>> {
    const response = await this.client.post('/sandbox/sessions', request, {
      timeout: config.api.longRequestTimeoutMs,
    });
    return response.data;
  }

  async stopSandboxSession(sessionId: string): Promise<ApiResponse<{ session: { session_id: string; state: string; simulator_id: string; created_at: string; updated_at: string; error?: string } }>> {
    const response = await this.client.post(`/sandbox/sessions/${sessionId}/stop`);
    return response.data;
  }

  async terminateSandboxSession(sessionId: string): Promise<ApiResponse<{ session: { session_id: string; state: string; simulator_id: string; created_at: string; updated_at: string; error?: string } }>> {
    const response = await this.client.post(`/sandbox/sessions/${sessionId}/terminate`);
    return response.data;
  }

  async getSandboxTelemetryUrl(): Promise<ApiResponse<{ url: string }>> {
    const response = await this.client.get('/sandbox/telemetry-url');
    return response.data;
  }

  async getSandboxLogsUrl(): Promise<ApiResponse<{ url: string }>> {
    const response = await this.client.get('/sandbox/logs-url');
    return response.data;
  }

  async resetSandboxVm(): Promise<ApiResponse<{ status: string; message: string }>> {
    const response = await this.client.post('/sandbox/vm/reset');
    return response.data;
  }

  async getSandboxVmStatus(): Promise<ApiResponse<{ status: Record<string, any> }>> {
    const response = await this.client.get('/sandbox/vm/status');
    return response.data;
  }

  async getSandboxMonitoringStatus(): Promise<ApiResponse<{ status: Record<string, any> }>> {
    const response = await this.client.get('/sandbox/monitoring/status');
    return response.data;
  }

  async getSandboxExecutionStatus(): Promise<ApiResponse<{ status: Record<string, any> }>> {
    const response = await this.client.get('/sandbox/execution/status');
    return response.data;
  }

  async getSandboxLogs(limit: number = 100, level?: string): Promise<ApiResponse<{ logs: Array<{ timestamp: string; message: string; level: string }> }>> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (level) params.append('level', level);
    const response = await this.client.get(`/sandbox/logs?${params}`);
    return response.data;
  }

  async startSandboxRuntime(): Promise<ApiResponse<{ message: string }>> {
    const response = await this.client.post('/sandbox/runtime/start');
    return response.data;
  }

  async getSessionMonitoring(sessionId: string): Promise<ApiResponse<{
    sessionId: string;
    totalEvents: number;
    process: number;
    file: number;
    registry: number;
    network: number;
    credential: number;
    severityCounts: Record<string, number>;
    suspiciousActivities: any[];
    isActive: boolean;
  }>> {
    const response = await this.client.get(`/sandbox/sessions/${sessionId}/monitoring`);
    return response.data;
  }

  async getSessionAIAnalysis(sessionId: string): Promise<ApiResponse<{ aiAnalysis: any }>> {
    const response = await this.client.get(`/sandbox/sessions/${sessionId}/ai-analysis`);
    return response.data;
  }

  // Sandbox Sessions (Legacy)
  async getSandboxSessions(params: PaginationParams): Promise<ApiResponse<SandboxSession[]>> {
    const response = await this.client.get('/sandbox/sessions', { params });
    return response.data;
  }

  async getSandboxSession(id: string): Promise<ApiResponse<SandboxSession>> {
    const response = await this.client.get(`/sandbox/sessions/${id}`);
    const raw = response.data;
    if (raw?.data?.session) {
      raw.data = raw.data.session;
    }
    return raw;
  }

  async getSandboxStats(): Promise<ApiResponse<{ total: number; byStatus: Record<string, number>; avgDuration: number }>> {
    const response = await this.client.get('/sandbox/stats');
    return response.data;
  }

  async clearSandboxSessions(): Promise<ApiResponse<{ deleted: number }>> {
    const response = await this.client.delete('/sandbox/sessions');
    return response.data;
  }

  // AI Analysis
  async analyzeTelemetry(sessionId: string, events: unknown[]): Promise<ApiResponse<TelemetryAnalysisResult>> {
    const response = await this.client.post('/ai/analyze/telemetry', { sessionId, events });
    return response.data;
  }

  async enrichAlert(alertData: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const response = await this.client.post('/ai/enrich/alert', alertData);
    return response.data;
  }

  async summarizeInvestigation(data: Record<string, unknown>): Promise<ApiResponse<InvestigationSummary>> {
    const response = await this.client.post('/ai/summarize/investigation', data);
    return response.data;
  }

  async analyzeReport(reportData: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const response = await this.client.post('/ai/analyze/report', reportData);
    return response.data;
  }

  async checkAIHealth(): Promise<ApiResponse<{ status: string }>> {
    const response = await this.client.get('/ai/health');
    return response.data;
  }

  // Sync Endpoints
  async getSyncHealth(): Promise<ApiResponse<{ status: string }>> {
    const response = await this.client.get('/sync/health');
    return response.data;
  }

  // Blockchain Verification
  async getBlockchainStatus(): Promise<ApiResponse<{ status: BlockchainStatus }>> {
    const response = await this.client.get('/blockchain/status');
    return response.data;
  }

  async getVerificationStats(): Promise<ApiResponse<{ stats: VerificationStats }>> {
    const response = await this.client.get('/blockchain/verification/stats');
    return response.data;
  }

  async registerEvidenceForBlockchain(evidenceId: string, filePath: string): Promise<ApiResponse<{
    fingerprint: string;
    blockchainVerification: unknown;
    integrityRecord: unknown;
  }>> {
    const response = await this.client.post('/blockchain/evidence/register', { evidenceId, filePath });
    return response.data;
  }

  async verifyEvidenceOnBlockchain(evidenceId: string, filePath: string): Promise<ApiResponse<VerificationResult>> {
    const response = await this.client.post('/blockchain/evidence/verify', { evidenceId, filePath });
    return response.data;
  }

  async batchVerifyEvidence(evidenceItems: Array<{ evidenceId: string; filePath: string }>): Promise<ApiResponse<BatchVerificationResult>> {
    const response = await this.client.post('/blockchain/evidence/batch-verify', { evidenceItems });
    return response.data;
  }

  async createEvidencePackage(
    investigationId: string,
    evidenceIds: string[],
    filePaths: string[]
  ): Promise<ApiResponse<unknown>> {
    const response = await this.client.post('/blockchain/package/create', {
      investigationId,
      evidenceIds,
      filePaths,
    });
    return response.data;
  }

  async verifyEvidencePackage(packageId: string): Promise<ApiResponse<PackageVerificationResult>> {
    const response = await this.client.post('/blockchain/package/verify', { packageId });
    return response.data;
  }

  async getBlockchainAuditLog(filters?: {
    evidenceId?: string;
    eventType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<ApiResponse<{ logs: BlockchainAuditEntry[] }>> {
    const response = await this.client.get('/blockchain/audit', { params: filters });
    return response.data;
  }

  async getInvestigationIntegrity(investigationId: string): Promise<ApiResponse<{ records: EvidenceIntegrityRecord[] }>> {
    const response = await this.client.get(`/blockchain/integrity/${investigationId}`);
    return response.data;
  }

  async getTamperAlerts(unacknowledged?: boolean): Promise<ApiResponse<{ alerts: TamperAlert[] }>> {
    const response = await this.client.get('/blockchain/alerts', { params: { unacknowledged } });
    return response.data;
  }

  async acknowledgeTamperAlert(evidenceId: string, alertId: string, notes?: string): Promise<ApiResponse<void>> {
    const response = await this.client.post(`/blockchain/alerts/${evidenceId}/${alertId}/acknowledge`, { notes });
    return response.data;
  }

  async getVerificationHistory(evidenceId: string): Promise<ApiResponse<{ history: unknown[] }>> {
    const response = await this.client.get(`/blockchain/verification/history/${evidenceId}`);
    return response.data;
  }

  async generateHash(data: string): Promise<ApiResponse<HashGenerationResult>> {
    const response = await this.client.post('/blockchain/hash/generate', { data });
    return response.data;
  }

async verifyHash(filePath: string, expectedHash: string): Promise<ApiResponse<HashVerificationResult>> {
    const response = await this.client.post('/blockchain/hash/verify', { filePath, expectedHash });
    return response.data;
  }

  // Reports
  async getReports(params?: {
    page?: number; limit?: number; simulator?: string;
    severity?: string; dateFrom?: string; dateTo?: string; search?: string;
  }): Promise<ApiResponse<ForensicReportSummary[]>> {
    const response = await this.client.get('/reports', { params });
    return response.data;
  }

  async getReport(id: string): Promise<ApiResponse<ForensicReportDetail>> {
    const response = await this.client.get(`/reports/${id}`);
    return response.data;
  }

  async exportReport(id: string, format: 'json' | 'text' | 'pdf' = 'json'): Promise<Blob> {
    const response = await this.client.get(`/reports/${id}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  }

  // Logs
  async getLogs(params?: {
    page?: number; limit?: number; level?: string;
    category?: string; search?: string; since?: number;
  }): Promise<ApiResponse<LogEntry[]>> {
    const response = await this.client.get('/logs', { params });
    return response.data;
  }

  async getLogStats(): Promise<ApiResponse<{
    totalLines: number;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
    files: string[];
  }>> {
    const response = await this.client.get('/logs/stats');
    return response.data;
  }

  // Audit Logs (structured user/system events: login, evidence uploaded, sessions)
  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
    status?: string;
    search?: string;
  }): Promise<ApiResponse<Array<{
    id: string;
    timestamp: string;
    action: string;
    entityType?: string;
    entityId?: string;
    status?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    user?: { id: string; username?: string; email?: string; name?: string } | null;
    errorMessage?: string;
  }>>> {
    const response = await this.client.get('/logs/audit', { params });
    return response.data;
  }

  async getAuditStats(): Promise<ApiResponse<{
    total: number;
    byAction: Array<{ action: string; count: number }>;
    byStatus: Record<string, number>;
  }>> {
    const response = await this.client.get('/logs/audit/stats');
    return response.data;
  }

  // Settings
  async getSettings(): Promise<ApiResponse<AppSettings>> {
    const response = await this.client.get('/settings');
    return response.data;
  }

  async updateSettings(settings: Partial<AppSettings>): Promise<ApiResponse<AppSettings>> {
    const response = await this.client.put('/settings', settings);
    return response.data;
  }

  async resetSettings(): Promise<ApiResponse<AppSettings>> {
    const response = await this.client.post('/settings/reset');
    return response.data;
  }

  // Evidence Artifacts
  async getEvidenceArtifacts(params?: {
    page?: number; limit?: number; category?: string; search?: string; source?: string;
  }): Promise<ApiResponse<EvidenceArtifact[]>> {
    const response = await this.client.get('/evidence/artifacts', { params });
    return response.data;
  }

  async getEvidenceArtifact(id: string): Promise<ApiResponse<ForensicEvidenceDetail>> {
    const response = await this.client.get(`/evidence/artifacts/${id}`);
    return response.data;
  }

  // Users
  async getUsers(params?: {
    page?: number; limit?: number; role?: string; search?: string;
  }): Promise<ApiResponse<{ users: User[]; total: number }>> {
    const response = await this.client.get('/users', { params });
    return response.data;
  }

  async getUser(id: string): Promise<ApiResponse<{ user: User }>> {
    const response = await this.client.get(`/users/${id}`);
    return response.data;
  }

  async createUser(data: {
    name: string; email: string; password: string;
    role: string; department?: string;
  }): Promise<ApiResponse<{ user: User }>> {
    const response = await this.client.post('/users', data);
    return response.data;
  }

  async updateUser(id: string, data: Partial<{
    name: string; email: string; password: string;
    role: string; department: string;
  }>): Promise<ApiResponse<{ user: User }>> {
    const response = await this.client.put(`/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/users/${id}`);
    return response.data;
  }

  async getUserActivity(userId: string): Promise<ApiResponse<{ activity: unknown[] }>> {
    const response = await this.client.get(`/users/${userId}/activity`);
    return response.data;
  }

  // Analytics & Forensic Analysis
  async getBehavioralPatterns(): Promise<ApiResponse<{ patterns: BehavioralPattern[] }>> {
    const response = await this.client.get('/analytics/patterns');
    return response.data;
  }

  async analyzeProcessBehavior(evidenceId: string): Promise<ApiResponse<{ behavior: ProcessBehavior }>> {
    const response = await this.client.post('/analytics/analyze-behavior', { evidenceId });
    return response.data;
  }

  async detectAnomalies(evidenceId: string): Promise<ApiResponse<{ anomalies: Anomaly[] }>> {
    const response = await this.client.post('/analytics/detect-anomalies', { evidenceId });
    return response.data;
  }

  async analyzeBaseline(investigationId: string): Promise<ApiResponse<unknown>> {
    const response = await this.client.post('/analytics/baseline', { investigationId });
    return response.data;
  }

  async getInvestigationClusters(): Promise<ApiResponse<{ clusters: InvestigationCluster[] }>> {
    const response = await this.client.get('/analytics/clusters');
    return response.data;
  }

  async getInvestigationRelationships(investigationId: string): Promise<ApiResponse<{ relationships: InvestigationRelationship[] }>> {
    const response = await this.client.get(`/analytics/clusters/${investigationId}/relationships`);
    return response.data;
  }

  async scoreRelationship(investigationId: string, targetInvestigationId: string): Promise<ApiResponse<{ score: number }>> {
    const response = await this.client.post(`/analytics/clusters/${investigationId}/score`, { targetInvestigationId });
    return response.data;
  }

  async getCorrelationInsights(investigationId?: string): Promise<ApiResponse<{ insights: CorrelationInsight[] }>> {
    const response = await this.client.get('/analytics/insights', { params: { investigationId } });
    return response.data;
  }

  async getClusterVisualization(): Promise<ApiResponse<unknown>> {
    const response = await this.client.get('/analytics/cluster-visualization');
    return response.data;
  }

  async getAnalyticsDashboard(): Promise<ApiResponse<AnalyticsDashboardData>> {
    const response = await this.client.get('/analytics/dashboard');
    return response.data;
  }

  // Comprehensive Forensic Report
  async getComprehensiveForensicReport(investigationId: string): Promise<ApiResponse<ComprehensiveForensicReport>> {
    try {
      const response = await this.client.get(`/investigations/${investigationId}/forensic-report`);
      return response.data;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return {
          success: false,
          message: 'Forensic report not yet generated for this investigation. Run a sandbox analysis first.',
          data: null as any,
        };
      }
      throw error;
    }
  }

  async analyzeSessionForensic(sessionId: string): Promise<ApiResponse<SessionForensicAnalysis>> {
    const response = await this.client.post('/analytics/session/analyze', { sessionId });
    return response.data;
  }

  async compareSessions(sessionIds: string[]): Promise<ApiResponse<SessionComparison>> {
    const response = await this.client.post('/analytics/sessions/compare', { sessionIds });
    return response.data;
  }

  // Threat Intelligence Analysis
  async analyzeDocument(file: File): Promise<ApiResponse<ThreatIntelAnalysis>> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.client.post('/analysis/document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return response.data;
  }

  async analyzeUrl(url: string): Promise<ApiResponse<ThreatIntelAnalysis>> {
    const response = await this.client.post('/analysis/url', { url }, { timeout: 60000 });
    return response.data;
  }

  async getThreatIntelAnalysis(id: string): Promise<ApiResponse<ThreatIntelAnalysis>> {
    const response = await this.client.get(`/analysis/${id}`);
    return response.data;
  }

  async getThreatIntelHistory(params?: {
    page?: number; limit?: number; type?: string; status?: string;
  }): Promise<ApiResponse<ThreatIntelAnalysis[]>> {
    const response = await this.client.get('/analysis', { params });
    return response.data as ApiResponse<ThreatIntelAnalysis[]>;
  }

  // Generic HTTP methods for flexibility
  //
  // GET requests are deduplicated when called concurrently with the same
  // URL+params: identical in-flight requests share a single Promise. This
  // prevents polling storms when multiple components mount and request the
  // same endpoint within `config.api.dedupTtlMs`.
  private inflight: Map<string, { promise: Promise<ApiResponse<any>>; expires: number }> = new Map();

  async get<T = any>(path: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const key = `${path}::${params ? JSON.stringify(params) : ''}`;
    const now = Date.now();

    // Prune stale entries
    for (const [k, entry] of this.inflight) {
      if (entry.expires < now) this.inflight.delete(k);
    }

    const existing = this.inflight.get(key);
    if (existing) {
      return existing.promise as Promise<ApiResponse<T>>;
    }

    const promise = (async () => {
      try {
        const response = await this.client.get<ApiResponse<T>>(path, { params });
        return response.data;
      } finally {
        // Hold the entry briefly so a burst of concurrent calls coalesces,
        // but release it so the next polling tick gets a fresh response.
        setTimeout(() => this.inflight.delete(key), config.api.dedupTtlMs);
      }
    })();

    this.inflight.set(key, { promise, expires: now + config.api.dedupTtlMs + 5_000 });
    return promise;
  }

  async post<T = any>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(path, data);
    return response.data;
  }

  async patch<T = any>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.client.patch<ApiResponse<T>>(path, data);
    return response.data;
  }

  // Knowledge Base
  async getKnowledgeArticles(params?: {
    page?: number; limit?: number; category?: string; type?: string; search?: string;
  }): Promise<ApiResponse<any[]>> {
    const response = await this.client.get('/knowledge-base', { params });
    return response.data;
  }

  async getKnowledgeArticle(id: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/knowledge-base/${id}`);
    return response.data;
  }

  async createKnowledgeArticle(data: Record<string, unknown>): Promise<ApiResponse<any>> {
    const response = await this.client.post('/knowledge-base', data);
    return response.data;
  }

  async updateKnowledgeArticle(id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> {
    const response = await this.client.put(`/knowledge-base/${id}`, data);
    return response.data;
  }

  async deleteKnowledgeArticle(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/knowledge-base/${id}`);
    return response.data;
  }

  // Roles
  async getRoles(): Promise<ApiResponse<any[]>> {
    const response = await this.client.get('/roles');
    return response.data;
  }

  async getPermissions(): Promise<ApiResponse<any[]>> {
    const response = await this.client.get('/roles/permissions');
    return response.data;
  }

  // System Config
  async getSystemConfig(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/config');
    return response.data;
  }

  async updateSystemConfig(section: string, values: Record<string, unknown>): Promise<ApiResponse<any>> {
    const response = await this.client.put('/config', { section, values });
    return response.data;
  }

  async getConfigSection(section: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/config/${section}`);
    return response.data;
  }

  async resetConfig(): Promise<ApiResponse<any>> {
    const response = await this.client.post('/config/reset');
    return response.data;
  }
}

export const api = new ApiService();
export default api;
