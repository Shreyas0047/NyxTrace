/**
 * Role-Based Access Control - Frontend Types
 */

export enum Role {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  FORENSIC_ANALYST = 'forensic_analyst',
  INVESTIGATOR = 'investigator',
  VIEWER = 'viewer',
  AUDITOR = 'auditor',
}

export const RoleLabels: Record<Role, string> = {
  [Role.SUPER_ADMIN]: 'Super Admin',
  [Role.ADMIN]: 'Administrator',
  [Role.FORENSIC_ANALYST]: 'Forensic Analyst',
  [Role.INVESTIGATOR]: 'Investigator',
  [Role.VIEWER]: 'Viewer',
  [Role.AUDITOR]: 'Auditor',
};

export enum Permission {
  // User Management
  USERS_VIEW = 'users:view',
  USERS_CREATE = 'users:create',
  USERS_UPDATE = 'users:update',
  USERS_DELETE = 'users:delete',
  USERS_MANAGE_ROLES = 'users:manage_roles',

  // Investigations
  INVESTIGATIONS_VIEW = 'investigations:view',
  INVESTIGATIONS_VIEW_ALL = 'investigations:view_all',
  INVESTIGATIONS_CREATE = 'investigations:create',
  INVESTIGATIONS_UPDATE = 'investigations:update',
  INVESTIGATIONS_DELETE = 'investigations:delete',
  INVESTIGATIONS_ARCHIVE = 'investigations:archive',

  // Evidence
  EVIDENCE_VIEW = 'evidence:view',
  EVIDENCE_VIEW_ALL = 'evidence:view_all',
  EVIDENCE_UPLOAD = 'evidence:upload',
  EVIDENCE_UPDATE = 'evidence:update',
  EVIDENCE_DELETE = 'evidence:delete',
  EVIDENCE_VERIFY = 'evidence:verify',

  // Alerts
  ALERTS_VIEW = 'alerts:view',
  ALERTS_ACKNOWLEDGE = 'alerts:acknowledge',
  ALERTS_RESOLVE = 'alerts:resolve',

  // Sandbox
  SANDBOX_VIEW = 'sandbox:view',
  SANDBOX_EXECUTE = 'sandbox:execute',
  SANDBOX_CONFIGURE = 'sandbox:configure',
  SANDBOX_MANAGE_VM = 'sandbox:manage_vm',

  // Telemetry
  TELEMETRY_VIEW = 'telemetry:view',
  TELEMETRY_ANALYZE = 'telemetry:analyze',

  // Reports
  REPORTS_VIEW = 'reports:view',
  REPORTS_CREATE = 'reports:create',
  REPORTS_EXPORT = 'reports:export',
  REPORTS_DELETE = 'reports:delete',

  // Threat Intel
  THREAT_VIEW = 'threat:view',
  THREAT_CREATE = 'threat:create',
  THREAT_UPDATE = 'threat:update',
  THREAT_DELETE = 'threat:delete',

  // Blockchain
  BLOCKCHAIN_VIEW = 'blockchain:view',
  BLOCKCHAIN_VERIFY = 'blockchain:verify',
  BLOCKCHAIN_CONFIGURE = 'blockchain:configure',
  BLOCKCHAIN_RECONCILE = 'blockchain:reconcile',

  // Analytics
  ANALYTICS_VIEW = 'analytics:view',
  ANALYTICS_EXPORT = 'analytics:export',

  // Settings
  SETTINGS_VIEW = 'settings:view',
  SETTINGS_UPDATE = 'settings:update',
  SETTINGS_SECURITY = 'settings:security',

  // Audit
  AUDIT_VIEW = 'audit:view',
  AUDIT_EXPORT = 'audit:export',

  // Health
  HEALTH_VIEW = 'health:view',
  HEALTH_MANAGE = 'health:manage',
}

export const RolePermissions: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: Object.values(Permission),
  [Role.ADMIN]: Object.values(Permission),

  [Role.FORENSIC_ANALYST]: [
    Permission.INVESTIGATIONS_VIEW,
    Permission.INVESTIGATIONS_CREATE,
    Permission.INVESTIGATIONS_UPDATE,
    Permission.EVIDENCE_VIEW,
    Permission.EVIDENCE_UPLOAD,
    Permission.EVIDENCE_UPDATE,
    Permission.EVIDENCE_VERIFY,
    Permission.ALERTS_VIEW,
    Permission.ALERTS_ACKNOWLEDGE,
    Permission.ALERTS_RESOLVE,
    Permission.SANDBOX_VIEW,
    Permission.SANDBOX_EXECUTE,
    Permission.TELEMETRY_VIEW,
    Permission.TELEMETRY_ANALYZE,
    Permission.REPORTS_VIEW,
    Permission.REPORTS_CREATE,
    Permission.REPORTS_EXPORT,
    Permission.THREAT_VIEW,
    Permission.THREAT_CREATE,
    Permission.THREAT_UPDATE,
    Permission.BLOCKCHAIN_VIEW,
    Permission.BLOCKCHAIN_VERIFY,
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_EXPORT,
  ],

  [Role.INVESTIGATOR]: [
    Permission.INVESTIGATIONS_VIEW,
    Permission.INVESTIGATIONS_VIEW_ALL,
    Permission.INVESTIGATIONS_CREATE,
    Permission.INVESTIGATIONS_UPDATE,
    Permission.EVIDENCE_VIEW,
    Permission.EVIDENCE_VIEW_ALL,
    Permission.EVIDENCE_UPLOAD,
    Permission.EVIDENCE_UPDATE,
    Permission.ALERTS_VIEW,
    Permission.ALERTS_ACKNOWLEDGE,
    Permission.SANDBOX_VIEW,
    Permission.SANDBOX_EXECUTE,
    Permission.TELEMETRY_VIEW,
    Permission.TELEMETRY_ANALYZE,
    Permission.REPORTS_VIEW,
    Permission.REPORTS_CREATE,
    Permission.THREAT_VIEW,
    Permission.BLOCKCHAIN_VIEW,
    Permission.ANALYTICS_VIEW,
  ],

  [Role.VIEWER]: [
    Permission.INVESTIGATIONS_VIEW,
    Permission.EVIDENCE_VIEW,
    Permission.ALERTS_VIEW,
    Permission.SANDBOX_VIEW,
    Permission.TELEMETRY_VIEW,
    Permission.REPORTS_VIEW,
    Permission.THREAT_VIEW,
    Permission.BLOCKCHAIN_VIEW,
    Permission.ANALYTICS_VIEW,
    Permission.HEALTH_VIEW,
  ],

  [Role.AUDITOR]: [
    Permission.INVESTIGATIONS_VIEW,
    Permission.INVESTIGATIONS_VIEW_ALL,
    Permission.EVIDENCE_VIEW,
    Permission.EVIDENCE_VIEW_ALL,
    Permission.ALERTS_VIEW,
    Permission.SANDBOX_VIEW,
    Permission.TELEMETRY_VIEW,
    Permission.REPORTS_VIEW,
    Permission.THREAT_VIEW,
    Permission.BLOCKCHAIN_VIEW,
    Permission.BLOCKCHAIN_VERIFY,
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_EXPORT,
    Permission.AUDIT_VIEW,
    Permission.AUDIT_EXPORT,
    Permission.HEALTH_VIEW,
  ],
};

export function hasPermission(userRole: Role, permission: Permission): boolean {
  const permissions = RolePermissions[userRole];
  return permissions.includes(permission);
}

export function isAdmin(role: Role): boolean {
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

export function isAnalyst(role: Role): boolean {
  return role === Role.FORENSIC_ANALYST;
}

export function isSuperAdmin(role: Role): boolean {
  return role === Role.SUPER_ADMIN;
}

export function isInvestigator(role: Role): boolean {
  return role === Role.INVESTIGATOR;
}

export function isViewer(role: Role): boolean {
  return role === Role.VIEWER;
}

export function isAuditor(role: Role): boolean {
  return role === Role.AUDITOR;
}