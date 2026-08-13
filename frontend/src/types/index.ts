// User & Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  createdAt: string;
  lastLogin?: string;
}

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'forensic_analyst'
  | 'security_reviewer'
  | 'sandbox_operator'
  | 'auditor';

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// Investigation Types
export interface Investigation {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  status: InvestigationStatus;
  priority: InvestigationPriority;
  category: InvestigationCategory;
  phase?: InvestigationPhase;
  createdAt: string;
  updatedAt: string;
  createdBy: User;
  leadAnalyst?: User;
  assignedAnalysts: AnalystAssignment[];
  evidenceCount: number;
  reportCount: number;
  alertCount: number;
  tags: string[];
  timeline?: TimelineEntry[];
}

export type InvestigationStatus =
  | 'pending'
  | 'active'
  | 'analyzing'
  | 'escalated'
  | 'resolved'
  | 'closed'
  | 'archived';

export type InvestigationPriority = 'critical' | 'high' | 'medium' | 'low';

export type InvestigationCategory =
  | 'malware'
  | 'data_breach'
  | 'phishing'
  | 'intrusion'
  | 'ransomware'
  | 'insider_threat'
  | 'ddos'
  | 'espionage'
  | 'fraud'
  | 'other';

export type InvestigationPhase =
  | 'identification'
  | 'containment'
  | 'eradication'
  | 'recovery'
  | 'lessons_learned';

export interface AnalystAssignment {
  userId: string;
  role: 'lead' | 'contributor' | 'reviewer';
  assignedAt: string;
  user?: User;
}

export interface TimelineEntry {
  timestamp: string;
  action: string;
  userId: string;
  userName: string;
  details: string;
}

// Evidence Types
export interface Evidence {
  id: string;
  evidenceId: string;
  investigationId: string;
  name: string;
  description: string;
  type: EvidenceType;
  status: EvidenceStatus;
  filePath: string;
  fileSize: number;
  /** Flat alias for fileSize emitted by some backend serializers. */
  size?: number;
  mimeType: string;
  hash?: {
    sha256?: string;
    md5?: string;
  };
  /** Flat alias for hash.sha256 emitted by some backend serializers. */
  sha256?: string;
  collectedAt: string;
  collectedBy: User;
  verified: boolean;
  verifiedAt?: string;
  blockchainVerified?: boolean;
  tags: string[];
  chainOfCustody: CustodyEntry[];
  analysisSummary?: string;
}

export type EvidenceType =
  | 'file'
  | 'memory_dump'
  | 'network_capture'
  | 'log'
  | 'screenshot'
  | 'registry_dump'
  | 'process_snapshot'
  | 'package'
  | 'malware_sample'
  | 'report'
  | 'other';

export type EvidenceStatus =
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'analyzing'
  | 'verified'
  | 'archived'
  | 'deleted';

export interface CustodyEntry {
  timestamp: string;
  action: string;
  userId: string;
  userName: string;
  details: string;
  location?: string;
  hash?: string;
}

// Alert Types
export interface Alert {
  id: string;
  alertId: string;
  title: string;
  description: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  source: AlertSource;
  detectedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  assignedTo?: User;
  investigationId?: string;
  tags: string[];
  iocIndicators?: IOCIndicator[];
  aiAnalysis?: AIAnalysisResult;
  mitreTechniques?: string[];
  relatedEvidenceIds?: string[];
}

export type AlertType =
  | 'system'
  | 'security'
  | 'investigation'
  | 'sandbox'
  | 'evidence'
  | 'threat_intel'
  | 'network'
  | 'endpoint';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AlertStatus =
  | 'new'
  | 'acknowledged'
  | 'in_progress'
  | 'escalated'
  | 'resolved'
  | 'false_positive'
  | 'closed';

export type AlertSource =
  | 'sandbox'
  | 'siem'
  | 'ids'
  | 'firewall'
  | 'endpoint'
  | 'network'
  | 'manual'
  | 'ai'
  | 'api';

export interface IOCIndicator {
  type: string;
  value: string;
  source: string;
  confidence: number;
}

export interface AIAnalysisResult {
  threatType?: string;
  confidence: number;
  recommendedActions?: string[];
  similarAlerts?: string[];
}

// Sandbox Session Types
export interface SandboxSession {
  id: string;
  sessionId: string;
  vmName: string;
  simulatorId: string;
  simulatorName: string;
  status: SandboxSessionStatus;
  startTime: string;
  endTime?: string;
  duration: number;
  eventsCollected: number;
  evidenceFiles: string[];
  errorMessages: string[];
  suspiciousScore?: number;
  executionSummary?: {
    simulatorId: string;
    simulatorName: string;
    findings: string[];
    iocIndicators: string[];
    riskScore: number;
    behavioralProfile: string;
    threatType: string;
    duration: number;
  };
}

export type SandboxSessionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout';

// Sandbox session extras returned by the backend (full stored document)
export interface SandboxSessionEvent {
  id?: string;
  timestamp?: string;
  type?: string;
  source?: string;
  details?: Record<string, unknown>;
  receivedAt?: string;
}

export type SandboxSessionWithExtras = SandboxSession & {
  recentEvents?: SandboxSessionEvent[];
  suspiciousEvents?: Array<SandboxSessionEvent & { reason?: string; flaggedAt?: string }>;
  extractedIOCs?: Array<{ type?: string; value?: string }>;
  aiAnalysis?: TelemetryAnalysisResult | null;
  rollbackStatus?: string;
};

// Analysis Report (document/URL) — backend AnalysisReport model payload
export interface AnalysisReportItem {
  id: string;
  analysisId: string;
  analysisType: 'document_analysis' | 'url_analysis';
  sourceType?: string;
  sourceName: string;
  sourceSize?: number;
  threatScore: number;
  threatLevel: string;
  confidence: number;
  predictedThreat?: string;
  findings: Array<{
    type?: string;
    title?: string;
    severity?: string;
    description?: string;
    category?: string;
    confidence?: number;
    evidence?: string[];
  }>;
  indicators: Array<{ type: string; value: string }>;
  iocCount: number;
  mitreTechniques: string[];
  heuristicsTriggered?: string[];
  recommendations: string[];
  summary?: string;
  aiInsights?: {
    llm_available?: boolean;
    provider?: string | null;
    model?: string | null;
    executive_summary?: string;
    classification_opinion?: string;
    mitre_techniques?: string[];
    recommendations?: string[];
    llm_confidence?: number | null;
  } | null;
  metadata?: Record<string, unknown>;
  analyzedBy?: string;
  analysisTimestamp: string;
}

// Telemetry Types
export interface TelemetryEvent {
  id?: string;
  type?: string;
  details?: string | Record<string, unknown>;
  session_id: string;
  timestamp: string;
  event_type: string;
  category: string;
  data: Record<string, unknown>;
  suspiciousScore?: number;
  /** Severity emitted by sandbox-agent ForensicEvent (CRITICAL/WARNING/INFO/etc.). */
  severity?: string;
  /** Optional human-readable message attached to log-style events. */
  message?: string;
}

export type TelemetryEventType =
  | 'process'
  | 'file'
  | 'registry'
  | 'network'
  | 'module'
  | 'memory'
  | 'behavior'
  | 'anomaly';

// AI Analysis Types
export interface TelemetryAnalysisResult {
  session_id: string;
  analysis_timestamp: string;
  total_events: number;
  suspicious_events: number;
  threat_classification: Record<string, number>;
  severity_score: number;
  severity_level: string;
  anomalies: AnomalyResult[];
  behavioral_summary: string;
  recommendations: string[];
  confidence: number;
}

export interface AnomalyResult {
  type: string;
  description: string;
  severity: string;
  deviation_score: number;
}

export interface InvestigationSummary {
  executive_summary: string;
  analyst_summary: string;
  key_findings: string[];
  timeline_summary: string;
  recommendations: string[];
  confidence: number;
}

// Dashboard Stats
export interface DashboardStats {
  totalInvestigations: number;
  activeInvestigations: number;
  criticalPriority: number;
  highPriority: number;
  totalEvidence: number;
  unverifiedEvidence: number;
  totalAlerts: number;
  criticalAlerts: number;
  openAlerts: number;
  sandboxSessionsToday: number;
  avgResolutionTime: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  status?: string;
  priority?: string;
  type?: string;
  search?: string;
}

// Permissions
export type Permission =
  | 'investigation_create'
  | 'investigation_read'
  | 'investigation_update'
  | 'investigation_delete'
  | 'evidence_upload'
  | 'evidence_read'
  | 'evidence_verify'
  | 'evidence_delete'
  | 'report_generate'
  | 'report_read'
  | 'alert_manage'
  | 'sandbox_execute'
  | 'sandbox_manage'
  | 'user_manage'
  | 'settings_manage'
  | 'audit_view';

export const RolePermissions: Record<UserRole, Permission[]> = {
  super_admin: [
    'investigation_create', 'investigation_read', 'investigation_update', 'investigation_delete',
    'evidence_upload', 'evidence_read', 'evidence_verify', 'evidence_delete',
    'report_generate', 'report_read', 'alert_manage', 'sandbox_execute', 'sandbox_manage',
    'user_manage', 'settings_manage', 'audit_view'
  ],
  admin: [
    'investigation_create', 'investigation_read', 'investigation_update', 'investigation_delete',
    'evidence_upload', 'evidence_read', 'evidence_verify', 'evidence_delete',
    'report_generate', 'report_read', 'alert_manage', 'sandbox_execute', 'sandbox_manage',
    'user_manage', 'audit_view'
  ],
  forensic_analyst: [
    'investigation_create', 'investigation_read', 'investigation_update',
    'evidence_upload', 'evidence_read', 'evidence_verify',
    'report_generate', 'report_read', 'alert_manage', 'sandbox_execute'
  ],
  security_reviewer: [
    'investigation_read', 'evidence_read', 'report_read', 'alert_manage'
  ],
  sandbox_operator: [
    'investigation_read', 'evidence_read', 'sandbox_execute', 'sandbox_manage'
  ],
  auditor: [
    'investigation_read', 'evidence_read', 'report_read', 'audit_view'
  ]
};

// Analytics & Forensic Analysis Types
export interface BehavioralPattern {
  id: string;
  name: string;
  category: string;
  description: string;
  severityWeight: number;
  mitreTactics: string[];
  mitreTechniques?: string[];
  detectionCriteria: string[];
}

export interface ProcessBehavior {
  processId: string;
  processName: string;
  behaviors: string[];
  riskScore: number;
  anomalies: string[];
}

export interface Anomaly {
  id: string;
  type: string;
  description: string;
  severity: string;
  timestamp: string;
  deviationScore: number;
  relatedEvents: string[];
}

export interface InvestigationCluster {
  id: string;
  name: string;
  investigationIds: string[];
  sharedIOCs: string[];
  similarityScore: number;
  firstSeen: string;
  lastSeen: string;
}

export interface InvestigationRelationship {
  sourceId: string;
  targetId: string;
  relationshipType: string;
  strength: number;
  sharedIndicators: string[];
}

export interface CorrelationInsight {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  relatedInvestigations: string[];
  indicators: string[];
  recommendedActions: string[];
  generatedAt: string;
}

export interface AnalyticsDashboardData {
  summary: {
    totalClusters: number;
    highSeverityInsights: number;
    totalPatterns: number;
    criticalPatterns: number;
  };
  clusters: InvestigationCluster[];
  insights: CorrelationInsight[];
  patterns: Array<{
    name: string;
    category: string;
    severity: string;
    mitreTactics: string[];
  }>;
}

export interface ComprehensiveForensicReport {
  investigationId: string;
  sessionId: string;
  analysisTimestamp: string;
  threatClassification: {
    threatType: string;
    confidence: number;
    severityLevel: string;
    severityScore: number;
    reasons?: string[];
  };
  mitreTechniques: Array<{
    id: string;
    name: string;
    tactic: string;
    description: string;
    evidence: string[];
  }>;
  attackChain: {
    chainId: string;
    stages: Array<{
      stageNumber: number;
      stageName: string;
      events: number;
      duration: number;
      indicators: string[];
      mitreTechniques: string[];
    }>;
    totalEvents: number;
    severity: string;
    confidence: number;
  };
  behavioralHeuristics: Array<{
    name: string;
    triggered: boolean;
    severity: string;
    confidence: number;
    description: string;
  }>;
  anomalies: Anomaly[];
  executiveSummary: string;
  analystExplanation: string;
  recommendations: string[];
}

export interface SessionForensicAnalysis {
  sessionId: string;
  analysisTimestamp: string;
  totalEvents: number;
  suspiciousEvents: number;
  threatClassification: Record<string, number>;
  predictedThreat: string;
  severityScore: number;
  severityLevel: string;
  anomalies: AnomalyResult[];
  behavioralSummary: string;
  recommendations: string[];
  confidence: number;
  reasons: string[];
  mitreTechniques: Array<{
    id: string;
    name: string;
    tactic: string;
    description: string;
    evidence: string[];
    confidence: number;
  }>;
  attackChain: {
    stages: Array<{
      stageName: string;
      events: number;
      mitreTechniques: string[];
      description?: string;
      severity?: string;
      timestamp?: string;
      status?: string;
    }>;
  };
  behavioralHeuristics: Array<{
    name: string;
    triggered: boolean;
    severity: string;
    confidence: number;
    description: string;
  }>;
  analystExplanation: string;
}

export interface SessionComparison {
  session1: {
    id: string;
    threatType: string;
    severityScore: number;
    mitreTechniques: string[];
    heuristicsTriggered: number;
  };
  session2: {
    id: string;
    threatType: string;
    severityScore: number;
    mitreTechniques: string[];
    heuristicsTriggered: number;
  };
  differences: {
    threatTypeMatch: boolean;
    severityDelta: number;
    sharedTechniques: string[];
    uniqueToSession1: string[];
    uniqueToSession2: string[];
  };
  comparisonTimestamp: string;
}

// Threat Intelligence Types
export interface AiInsights {
  llm_available: boolean;
  provider?: string | null;
  model?: string | null;
  executive_summary?: string | null;
  classification_opinion?: string | null;
  mitre_techniques?: string[];
  recommendations?: string[];
  llm_confidence?: number | null;
}

export interface ThreatIntelAnalysis {
  id: string;
  type: 'document' | 'url' | 'ioc_collection';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileName?: string;
  fileSize?: number;
  url?: string;
  threatScore: number;
  threatLevel: 'critical' | 'high' | 'medium' | 'low' | 'benign';
  confidence: number;
  summary: string;
  iocs: ExtractedIOC[];
  mitreTechniques: string[];
  mitreTactics: string[];
  findings: AnalysisFinding[];
  sections?: DocumentSection[];
  urlReputation?: UrlReputation;
  rawText?: string;
  aiInsights?: AiInsights;
  analyzedAt: string;
  error?: string;
}

export interface ExtractedIOC {
  type: 'ip' | 'domain' | 'url' | 'hash' | 'email' | 'registry' | 'process' | 'filepath';
  value: string;
  context: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  mitreMapping?: string;
}

export interface AnalysisFinding {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'malware' | 'phishing' | 'exploit' | 'recon' | 'persistence' | 'evasion' | 'collection' | 'command';
  confidence: number;
  evidence: string[];
  mitreMapping?: string;
}

export interface DocumentSection {
  heading: string;
  content: string;
  pageNumber: number;
  suspicious: boolean;
  riskIndicators: string[];
}

export interface UrlReputation {
  malicious: boolean;
  riskScore: number;
  categories: string[];
  firstSeen: string;
  lastAnalyzed: string;
  registrar?: string;
  registrantCountry?: string;
  creationDate?: string;
  domainAge: number;
  sslValid: boolean;
  redirectChain: string[];
  technologies: string[];
  threatIntelMatches: string[];
}

export interface ThreatIntelSummary {
  totalAnalyses: number;
  totalIOCs: number;
  criticalFindings: number;
  highFindings: number;
  maliciousUrls: number;
  maliciousDocuments: number;
  topThreats: { type: string; count: number }[];
  recentAnalyses: ThreatIntelAnalysis[];
  iocByType: Record<string, number>;
}

// Re-export blockchain types
export * from './blockchain';