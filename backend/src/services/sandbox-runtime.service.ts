/**
 * Sandbox Runtime Service
 * Communicates with the headless sandbox runtime API
 */

import axios, { AxiosInstance } from 'axios';
import { AppError } from '../middleware';
import { getCorrelationId } from '../middleware/request-context';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import fs from 'fs';
import { promisify } from 'util';
const execAsync = promisify(require('child_process').exec);

export interface RuntimeHealth {
  status: string;
  version: string;
  uptime_seconds: number;
  vm_status: Record<string, any>;
  active_sessions: number;
  telemetry_connections: number;
}

export interface SimulatorInfo {
  id: string;
  display_name: string;
  description: string;
  category: string;
}

export interface RuntimeSession {
  session_id: string;
  state: string;
  simulator_id: string;
  created_at: string;
  updated_at: string;
  error?: string;
}

export interface StartSessionRequest {
  simulator_id: string;
  auto_rollback: boolean;
  timeout_seconds: number;
}

let runtimeStarted = false;
let runtimeCheckInProgress = false;
let runtimeStarting = false;

export class SandboxRuntimeService {
  private client: AxiosInstance;
  private baseUrl: string;
  private sessionMonitors: Map<string, boolean> = new Map();
  private consecutiveFailures = 0;
  private readonly maxConsecutiveFailures = 3;

  constructor() {
    this.baseUrl = process.env.SANDBOX_RUNTIME_URL || 'http://127.0.0.1:8765';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Secret': process.env.SANDBOX_AGENT_SECRET || '',
      },
    });

    // Forward the current request's correlation ID so sandbox-agent logs
    // can be joined with backend + frontend logs for end-to-end tracing.
    this.client.interceptors.request.use((cfg) => {
      const correlationId = getCorrelationId();
      if (correlationId) {
        cfg.headers.set('X-Correlation-ID', correlationId);
      }
      return cfg;
    });

    // Response interceptor: track connectivity and reset on success
    this.client.interceptors.response.use(
      (response) => {
        this.consecutiveFailures = 0;
        runtimeStarted = true;
        return response;
      },
      (error) => {
        if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
          this.consecutiveFailures++;
          if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
            runtimeStarted = false;
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async monitorSessionCompletion(
    sessionId: string,
    onComplete: (session: RuntimeSession) => Promise<void>,
  ): Promise<void> {
    if (this.sessionMonitors.has(sessionId)) return;
    this.sessionMonitors.set(sessionId, true);

    let lastState = '';

    const poll = async (attempts: number) => {
      if (!this.sessionMonitors.has(sessionId)) return;
      if (attempts >= 90) {
        this.sessionMonitors.delete(sessionId);
        return;
      }
      try {
        const session = await this.getSession(sessionId);
        const state = session.state.toUpperCase();

        // Emit intermediate state changes via WebSocket so frontend stays in sync
        if (session.state !== lastState) {
          lastState = session.state;
          const { websocketService } = await import('./websocket.service');
          websocketService.emitSandboxSessionUpdate(sessionId, session);
        }

        if (state === 'COMPLETED' || state === 'FAILED') {
          this.sessionMonitors.delete(sessionId);
          // Emit structured error via WebSocket when session fails
          if (state === 'FAILED') {
            const { websocketService: ws } = await import('./websocket.service');
            ws.emitSandboxError(sessionId, {
              code: 'SESSION_FAILED',
              message: session.error || 'Session execution failed',
              stage: session.state,
            });
          }
          await onComplete(session);
          return;
        }
      } catch (err: any) {
        // Stop polling if session doesn't exist (404) — runtime was restarted
        if (err?.statusCode === 404 || err?.status === 404 || err?.message?.includes('404')) {
          this.sessionMonitors.delete(sessionId);
          return;
        }
      }
      setTimeout(() => poll(attempts + 1), 3000);
    };

    setTimeout(() => poll(0), 3000);
  }

  private async ensureRuntimeStarted(): Promise<void> {
    if (runtimeStarted) return;
    if (runtimeCheckInProgress) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      return;
    }

    runtimeCheckInProgress = true;

    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.client.get('/health', { timeout: 3000 });
          runtimeStarted = true;
          return;
        } catch {
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      // Runtime is not reachable — do NOT auto-spawn; operator must start manually
    } finally {
      runtimeCheckInProgress = false;
    }
  }

  private handleError(error: any): never {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        throw new AppError('Sandbox runtime service is not running. Click "Start Runtime" in the UI or run the sandbox runtime manually.', 503, 'RUNTIME_UNAVAILABLE');
      }
      throw new AppError(
        error.response?.data?.detail || error.message,
        error.response?.status || 500,
        'RUNTIME_ERROR'
      );
    }
    throw new AppError('Unknown error communicating with sandbox runtime', 500, 'RUNTIME_ERROR');
  }

  async getHealth(): Promise<RuntimeHealth> {
    try {
      if (!runtimeStarted) {
        await this.ensureRuntimeStarted();
      }
      const response = await this.client.get<RuntimeHealth>('/health');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.get('/health', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async listSimulators(): Promise<SimulatorInfo[]> {
    try {
      const response = await this.client.get<SimulatorInfo[]>('/simulators');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async startSession(request: StartSessionRequest): Promise<RuntimeSession> {
    try {
      if (!runtimeStarted) {
        await this.ensureRuntimeStarted();
      }
      const response = await this.client.post<RuntimeSession>('/sessions/start', request, {
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSession(sessionId: string): Promise<RuntimeSession> {
    try {
      if (!runtimeStarted) {
        await this.ensureRuntimeStarted();
      }
      const response = await this.client.get<RuntimeSession>(`/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSessionEvents(sessionId: string): Promise<{ events: any[] }> {
    try {
      if (!runtimeStarted) {
        await this.ensureRuntimeStarted();
      }
      const response = await this.client.get<{ events: any[] }>(`/sessions/${sessionId}/events`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async listSessions(): Promise<RuntimeSession[]> {
    try {
      const response = await this.client.get<RuntimeSession[]>('/sessions');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

async stopSession(sessionId: string): Promise<RuntimeSession> {
    try {
      const response = await this.client.post<RuntimeSession>(`/sessions/${sessionId}/stop`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async terminateSession(sessionId: string): Promise<RuntimeSession> {
    try {
      const response = await this.client.post<RuntimeSession>(`/sessions/${sessionId}/terminate`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getLogs(limit: number = 100, level?: string): Promise<{ logs: Array<{ timestamp: string; message: string; level: string }> }> {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (level) params.append('level', level);
      const response = await this.client.get<{ logs: Array<{ timestamp: string; message: string; level: string }> }>(`/logs?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  getTelemetryUrl(): string {
    return `${this.baseUrl.replace('http', 'ws')}/telemetry/live`;
  }

  getLogsUrl(): string {
    return `${this.baseUrl.replace('http', 'ws')}/logs/live`;
  }

  async resetVm(): Promise<{ status: string; message: string }> {
    try {
      const response = await this.client.post<{ status: string; message: string }>('/vm/reset');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getVmStatus(): Promise<Record<string, any>> {
    try {
      const response = await this.client.get<Record<string, any>>('/vm/status');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getMonitoringStatus(): Promise<Record<string, any>> {
    try {
      const response = await this.client.get<Record<string, any>>('/monitoring/status');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getExecutionStatus(): Promise<Record<string, any>> {
    try {
      const response = await this.client.get<Record<string, any>>('/execution/status');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  isRuntimeStarting(): boolean {
    return runtimeStarting;
  }

  async startRuntime(): Promise<{ logFile: string; pythonPath: string }> {
    if (runtimeStarting) {
      throw new Error('Runtime is already starting. Please wait.');
    }

    runtimeStarting = true;

    const resetStarting = () => { runtimeStarting = false; };
    setTimeout(resetStarting, 10000);

    try {
      let projectRoot = process.env.SANDBOX_PROJECT_ROOT || process.cwd();
      if (!fs.existsSync(join(projectRoot, 'sandbox-agent-v2'))) {
        let candidate = process.cwd();
        for (let i = 0; i < 5; i++) {
          if (fs.existsSync(join(candidate, 'sandbox-agent-v2'))) {
            projectRoot = candidate;
            break;
          }
          const parent = dirname(candidate);
          if (parent === candidate) break;
          candidate = parent;
        }
      }
      const runtimeFilePath = join(projectRoot, 'sandbox-agent-v2', 'main.py');

      if (!fs.existsSync(runtimeFilePath)) {
        runtimeStarting = false;
        throw new Error(`Runtime script not found at: ${runtimeFilePath}`);
      }

      let pythonPath: string | null = null;
      const isWin = process.platform === 'win32';
      const pythonCandidates = [
        process.env.PYTHON_PATH,
        'python3',
        'python',
        ...(isWin ? ['py'] : []),
      ].filter(Boolean) as string[];

      for (const candidate of pythonCandidates) {
        if (!candidate) continue;
        if (candidate.includes('\\') || candidate.includes('/')) {
          if (fs.existsSync(candidate)) {
            pythonPath = candidate;
            break;
          }
        } else {
          try {
            const whichCmd = isWin ? 'where' : 'command -v';
            const { stdout } = await execAsync(`${whichCmd} ${candidate}`);
            const path = stdout.trim().split('\n')[0];
            if (path) {
              pythonPath = path;
              break;
            }
          } catch {
            continue;
          }
        }
      }

      if (!pythonPath) {
        runtimeStarting = false;
        throw new Error(
          'Python not found. Install Python 3.11+ and add to PATH, or set PYTHON_PATH environment variable.'
        );
      }

      const logDir = join(projectRoot, 'sandbox-agent-v2');
      const logFile = join(logDir, 'runtime.log');

      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      try {
        if (isWin) {
          const { stdout: netstatOut } = await execAsync('netstat -ano | findstr :8765');
          const lines = netstatOut.trim().split('\n').filter((l: string) => l.includes('LISTENING'));
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
              try { await execAsync(`taskkill /F /PID ${pid}`); } catch { /* process may already be gone */ }
            }
          }
        } else {
          try { await execAsync('lsof -ti :8765 | xargs -r kill -9'); } catch { /* process may already be gone */ }
        }
      } catch { /* port may be free */ }

      const logFd = fs.openSync(logFile, 'a');
      const child = spawn(pythonPath, ['-u', runtimeFilePath], {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        cwd: join(projectRoot, 'sandbox-agent-v2'),
        env: { ...process.env, PYTHONPATH: join(projectRoot, 'sandbox-agent-v2') },
        ...(isWin ? { windowsHide: true } : {}),
      });

      fs.closeSync(logFd);
      child.unref();

      child.on('error', (err: Error) => {
        const logger = require('../config/logger').default;
        logger.error(`[Sandbox] Runtime spawn error: ${err.message}`);
      });

      child.on('exit', (code: number | null) => {
        runtimeStarting = false;
        const logger = require('../config/logger').default;
        logger.info(`[Sandbox] Runtime exited with code ${code}`);
      });

      return { logFile, pythonPath };
    } catch (error) {
      runtimeStarting = false;
      throw error;
    }
  }
}

export const sandboxRuntimeService = new SandboxRuntimeService();
export default sandboxRuntimeService;
