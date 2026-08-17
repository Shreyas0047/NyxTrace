/**
 * Core Type Definitions
 * Central type exports for the NyxTrace backend
 */

import { Types } from 'mongoose';

// ============================================
// USER ROLES - Hierarchical Enterprise RBAC
// ============================================

export enum UserRole {
  // Tier 1: Full System Control
  SUPER_ADMIN = 'super_admin',

  // Tier 2: Administrative
  ADMIN = 'admin',

  // Tier 3: Operational
  FORENSIC_ANALYST = 'forensic_analyst',
  SECURITY_REVIEWER = 'security_reviewer',

  // Tier 4: Limited Operations
  SANDBOX_OPERATOR = 'sandbox_operator',

  // Tier 5: Read-Only
  AUDITOR = 'auditor',
}

// Role hierarchy for RBAC checks
export const RoleHierarchy: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.ADMIN]: 80,
  [UserRole.FORENSIC_ANALYST]: 60,
  [UserRole.SECURITY_REVIEWER]: 40,
  [UserRole.SANDBOX_OPERATOR]: 20,
  [UserRole.AUDITOR]: 10,
};

// Role display names
export const RoleNames: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Super Administrator',
  [UserRole.ADMIN]: 'Administrator',
  [UserRole.FORENSIC_ANALYST]: 'Forensic Analyst',
  [UserRole.SECURITY_REVIEWER]: 'Security Reviewer',
  [UserRole.SANDBOX_OPERATOR]: 'Sandbox Operator',
  [UserRole.AUDITOR]: 'Read-only Auditor',
};

// ============================================
// PERMISSIONS SYSTEM
// ============================================

export enum Permission {
  // User Management
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_ACTIVATE = 'user:activate',
  USER_DEACTIVATE = 'user:deactivate',
  USER_ROLE_ASSIGN = 'user:role:assign',

  // Investigation Management
  INVESTIGATION_CREATE = 'investigation:create',
  INVESTIGATION_READ = 'investigation:read',
  INVESTIGATION_UPDATE = 'investigation:update',
  INVESTIGATION_DELETE = 'investigation:delete',
  INVESTIGATION_ASSIGN = 'investigation:assign',
  INVESTIGATION_CLOSE = 'investigation:close',

  // Evidence Management
  EVIDENCE_UPLOAD = 'evidence:upload',
  EVIDENCE_READ = 'evidence:read',
  EVIDENCE_VERIFY = 'evidence:verify',
  EVIDENCE_DELETE = 'evidence:delete',
  EVIDENCE_DOWNLOAD = 'evidence:download',

  // Report Management
  REPORT_CREATE = 'report:create',
  REPORT_READ = 'report:read',
  REPORT_UPDATE = 'report:update',
  REPORT_DELETE = 'report:delete',
  REPORT_EXPORT = 'report:export',
  REPORT_APPROVE = 'report:approve',

  // Sandbox Operations
  SANDBOX_EXECUTE = 'sandbox:execute',
  SANDBOX_VIEW = 'sandbox:view',
  SANDBOX_TELEMETRY = 'sandbox:telemetry',

  // AI Analysis
  AI_ANALYSIS_RUN = 'ai:analysis:run',
  AI_ANALYSIS_VIEW = 'ai:analysis:view',

  // System Administration
  SYSTEM_SETTINGS = 'system:settings',
  SYSTEM_DIAGNOSTICS = 'system:diagnostics',
  SYSTEM_LOGS = 'system:logs',

  // Audit & Compliance
  AUDIT_VIEW = 'audit:view',
  AUDIT_EXPORT = 'audit:export',
}

// Role-Permission mapping
export const RolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),

  [UserRole.ADMIN]: [
    // User management (no delete or role assignment)
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_ACTIVATE,
    Permission.USER_DEACTIVATE,
    // Investigation
    Permission.INVESTIGATION_CREATE,
    Permission.INVESTIGATION_READ,
    Permission.INVESTIGATION_UPDATE,
    Permission.INVESTIGATION_ASSIGN,
    Permission.INVESTIGATION_CLOSE,
    // Evidence
    Permission.EVIDENCE_UPLOAD,
    Permission.EVIDENCE_READ,
    Permission.EVIDENCE_VERIFY,
    Permission.EVIDENCE_DELETE,
    Permission.EVIDENCE_DOWNLOAD,
    // Reports
    Permission.REPORT_CREATE,
    Permission.REPORT_READ,
    Permission.REPORT_UPDATE,
    Permission.REPORT_DELETE,
    Permission.REPORT_EXPORT,
    Permission.REPORT_APPROVE,
    // Sandbox
    Permission.SANDBOX_VIEW,
    Permission.SANDBOX_TELEMETRY,
    // AI
    Permission.AI_ANALYSIS_RUN,
    Permission.AI_ANALYSIS_VIEW,
    // Audit
    Permission.AUDIT_VIEW,
    Permission.AUDIT_EXPORT,
  ],

  [UserRole.FORENSIC_ANALYST]: [
    // Own investigations
    Permission.INVESTIGATION_READ,
    Permission.INVESTIGATION_UPDATE,
    // Evidence
    Permission.EVIDENCE_UPLOAD,
    Permission.EVIDENCE_READ,
    Permission.EVIDENCE_VERIFY,
    Permission.EVIDENCE_DOWNLOAD,
    // Reports
    Permission.REPORT_CREATE,
    Permission.REPORT_READ,
    Permission.REPORT_UPDATE,
    Permission.REPORT_EXPORT,
    // Sandbox
    Permission.SANDBOX_VIEW,
    Permission.SANDBOX_TELEMETRY,
    // AI
    Permission.AI_ANALYSIS_RUN,
    Permission.AI_ANALYSIS_VIEW,
  ],

  [UserRole.SECURITY_REVIEWER]: [
    Permission.INVESTIGATION_READ,
    Permission.EVIDENCE_READ,
    Permission.EVIDENCE_DOWNLOAD,
    Permission.REPORT_READ,
    Permission.REPORT_APPROVE,
    Permission.SANDBOX_VIEW,
    Permission.AI_ANALYSIS_VIEW,
    Permission.AUDIT_VIEW,
  ],

  [UserRole.SANDBOX_OPERATOR]: [
    Permission.SANDBOX_VIEW,
    Permission.SANDBOX_EXECUTE,
    Permission.SANDBOX_TELEMETRY,
    Permission.EVIDENCE_UPLOAD,
    Permission.INVESTIGATION_READ,
  ],

  [UserRole.AUDITOR]: [
    Permission.INVESTIGATION_READ,
    Permission.EVIDENCE_READ,
    Permission.REPORT_READ,
    Permission.SANDBOX_VIEW,
    Permission.AUDIT_VIEW,
    Permission.AUDIT_EXPORT,
  ],
};

// ============================================
// USER TYPES
// ============================================

export interface IUser {
  _id: Types.ObjectId | string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  isLocked: boolean;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastLogin?: Date;
  lastLoginIp?: string;
  passwordChangedAt?: Date;
  mustChangePassword: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Account status for user management
export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  LOCKED = 'locked',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

// ============================================
// INVESTIGATION TYPES
// ============================================

export interface IInvestigation {
  _id: string;
  title: string;
  description: string;
  status: InvestigationStatus;
  priority: InvestigationPriority;
  caseNumber: string;
  assignedTo: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  tags: string[];
  evidenceCount: number;
  reportCount: number;
}

export enum InvestigationStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  ANALYZING = 'analyzing',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}

export enum InvestigationPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

// ============================================
// EVIDENCE TYPES
// ============================================

export interface IEvidence {
  _id: string;
  investigationId: string;
  name: string;
  description: string;
  type: EvidenceType;
  filePath: string;
  fileSize: number;
  mimeType: string;
  hash?: EvidenceHash;
  chainOfCustody: ChainOfCustodyEntry[];
  collectedAt: Date;
  collectedBy: string;
  uploadedAt: Date;
  verified: boolean;
  tags: string[];
}

export enum EvidenceType {
  FILE = 'file',
  MEMORY_DUMP = 'memory_dump',
  NETWORK_CAPTURE = 'network_capture',
  LOG = 'log',
  SCREENSHOT = 'screenshot',
  REPORT = 'report',
  EXECUTABLE = 'executable',
  DOCUMENT = 'document',
  URL = 'url',
  OTHER = 'other',
}

export enum EvidenceSource {
  MANUAL_UPLOAD = 'manual_upload',
  SANDBOX_EXECUTION = 'sandbox_execution',
  NETWORK_CAPTURE = 'network_capture',
  ENDPOINT_COLLECTION = 'endpoint_collection',
  IMPORTED = 'imported',
  API_RECEIVED = 'api_received',
}

export enum EvidenceStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  ANALYZING = 'analyzing',
  VERIFIED = 'verified',
  TAMPERED = 'tampered',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

export interface EvidenceHash {
  sha256?: string;
  md5?: string;
}

export interface ChainOfCustodyEntry {
  timestamp: Date;
  action: string;
  userId: string;
  details: string;
}

// ============================================
// REPORT TYPES
// ============================================

export interface IReport {
  _id: string;
  investigationId: string;
  title: string;
  type: ReportType;
  summary: string;
  findings: ReportFinding[];
  recommendations: string[];
  generatedAt: Date;
  generatedBy: string;
  version: string;
  status: ReportStatus;
}

export enum ReportType {
  INVESTIGATION = 'investigation',
  EVIDENCE = 'evidence',
  THREAT_ANALYSIS = 'threat_analysis',
  EXECUTIVE = 'executive',
}

export enum ReportStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  FINAL = 'final',
}

export enum ReportSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFORMATIONAL = 'informational',
}

export interface ReportFinding {
  category: string;
  severity: string;
  description: string;
  timestamp: Date;
  indicators: string[];
}

// ============================================
// ALERT TYPES
// ============================================

export interface IAlert {
  _id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: string;
  investigationId?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  createdAt: Date;
}

export enum AlertType {
  SYSTEM = 'system',
  SECURITY = 'security',
  INVESTIGATION = 'investigation',
  SANDBOX = 'sandbox',
  EVIDENCE = 'evidence',
}

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum AlertSource {
  SANDBOX = 'sandbox',
  SIEM = 'siem',
  IDS = 'ids',
  FIREWALL = 'firewall',
  ENDPOINT = 'endpoint',
  NETWORK = 'network',
  MANUAL = 'manual',
  AI = 'ai',
  API = 'api',
}

// ============================================
// SANDBOX SYNC TYPES
// ============================================

export interface ISandboxSession {
  _id: string;
  sessionId: string;
  vmName: string;
  simulatorId: string;
  simulatorName: string;
  status: SandboxSessionStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  exitCode?: number;
  eventsCollected: number;
  evidenceFiles: string[];
  errorMessages: string[];
  syncedAt: Date;
}

export enum SandboxSessionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ApiError[];
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  field?: string;
  message: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================
// AUTH TYPES
// ============================================

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

// ============================================
// REQUEST TYPES
// ============================================

export interface PaginatedRequest {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface FilterRequest {
  search?: string;
  status?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ============================================
// AUDIT TYPES
// ============================================

export interface IAuditLog {
  _id: string;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export enum AuditAction {
  // Auth events
  LOGIN = 'auth:login',
  LOGIN_FAILED = 'auth:login_failed',
  LOGOUT = 'auth:logout',
  TOKEN_REFRESH = 'auth:token_refresh',
  PASSWORD_CHANGE = 'auth:password_change',
  PASSWORD_RESET_REQUEST = 'auth:password_reset_request',
  PASSWORD_RESET_COMPLETE = 'auth:password_reset_complete',

  // User events
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_ACTIVATE = 'user:activate',
  USER_DEACTIVATE = 'user:deactivate',
  USER_ROLE_CHANGE = 'user:role_change',

  // Investigation events
  INVESTIGATION_CREATE = 'investigation:create',
  INVESTIGATION_UPDATE = 'investigation:update',
  INVESTIGATION_DELETE = 'investigation:delete',

  // Evidence events
  EVIDENCE_UPLOAD = 'evidence:upload',
  EVIDENCE_DELETE = 'evidence:delete',
  EVIDENCE_VERIFY = 'evidence:verify',
}

export * from './reports';