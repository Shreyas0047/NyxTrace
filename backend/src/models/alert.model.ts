/**
 * Alert Model - Enhanced Enterprise Edition
 * Comprehensive alert and incident management
 */

import mongoose, { Schema } from 'mongoose';

// ============================================
// ALERT TYPE ENUM
// ============================================

export enum AlertType {
  SYSTEM = 'system',
  SECURITY = 'security',
  INVESTIGATION = 'investigation',
  SANDBOX = 'sandbox',
  EVIDENCE = 'evidence',
  THREAT_INTEL = 'threat_intel',
  NETWORK = 'network',
  ENDPOINT = 'endpoint',
}

// ============================================
// ALERT SEVERITY ENUM
// ============================================

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

// ============================================
// ALERT STATUS ENUM
// ============================================

export enum AlertStatus {
  NEW = 'new',
  ACKNOWLEDGED = 'acknowledged',
  IN_PROGRESS = 'in_progress',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  FALSE_POSITIVE = 'false_positive',
  CLOSED = 'closed',
}

// ============================================
// ALERT SOURCE ENUM
// ============================================

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
// INDICATOR OF COMPROMISE
// ============================================

export interface IOCIndicator {
  type: string;
  value: string;
  source: string;
  confidence: number;
  firstSeen: Date;
  lastSeen: Date;
}

// ============================================
// ALERT SCHEMA
// ============================================

const alertSchema = new Schema({
  // Core identification
  alertId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Basic info
  title: {
    type: String,
    required: true,
    maxlength: 500,
  },
  description: {
    type: String,
    required: true,
    maxlength: 5000,
  },

  // Classification
  type: {
    type: String,
    enum: Object.values(AlertType),
    required: true,
  },
  severity: {
    type: String,
    enum: Object.values(AlertSeverity),
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(AlertStatus),
    default: AlertStatus.NEW,
  },
  source: {
    type: String,
    enum: Object.values(AlertSource),
    required: true,
  },

  // Investigation reference
  investigationId: {
    type: Schema.Types.ObjectId,
    ref: 'Investigation',
  },
  investigationCaseNumber: String,

  // Timestamps
  detectedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  acknowledgedAt: Date,
  resolvedAt: Date,
  closedAt: Date,

  // Assignment
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  assignedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  assignedAt: Date,

  // Acknowledgement
  acknowledgedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  acknowledgmentNote: String,

  // Resolution
  resolution: {
    summary: String,
    rootCause: String,
    actionTaken: String,
    falsePositive: Boolean,
    escalated: Boolean,
  },
  resolvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },

  // Technical details
  sourceIp: String,
  destinationIp: String,
  sourcePort: Number,
  destinationPort: Number,
  protocol: String,
  hostname: String,
  processName: String,
  filePath: String,

  // Indicators of compromise
  iocIndicators: [{
    type: { type: String },
    value: String,
    source: String,
    confidence: Number,
    firstSeen: Date,
    lastSeen: Date,
  }],
  mitreTechniques: [String],

  // Related entities
  relatedAlertIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Alert',
  }],
  relatedEvidenceIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Evidence',
  }],
  relatedSandboxSessionId: {
    type: Schema.Types.ObjectId,
    ref: 'SandboxSession',
  },

  // Context and metadata
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  metadata: {
    type: Schema.Types.Mixed,
  },
  rawLog: String,

  // AI Analysis
  aiAnalysisCompleted: {
    type: Boolean,
    default: false,
  },
  aiAnalysis: {
    threatType: String,
    confidence: Number,
    recommendedActions: [String],
    similarAlerts: [String],
  },

  // Escalation
  escalationLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  escalatedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  escalatedAt: Date,
  escalationReason: String,

}, {
  timestamps: true,
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// ============================================
// INDEXES
// ============================================

// Compound indexes
alertSchema.index({ severity: 1, status: 1 });
alertSchema.index({ detectedAt: -1 });
alertSchema.index({ assignedTo: 1, status: 1 });
alertSchema.index({ investigationId: 1, status: 1 });
alertSchema.index({ type: 1, severity: 1 });
alertSchema.index({ tags: 1 });
alertSchema.index({ source: 1, detectedAt: -1 });
alertSchema.index({ resolvedBy: 1, resolvedAt: -1 });

// TTL index - auto-delete after 1 year (optional, can be removed)
alertSchema.index({ detectedAt: 1 }, { expireAfterSeconds: 31536000 });

// ============================================
// METHODS
// ============================================

// Acknowledge alert
alertSchema.methods.acknowledge = function(userId: string, note?: string) {
  this.status = AlertStatus.ACKNOWLEDGED;
  this.acknowledgedAt = new Date();
  this.acknowledgedBy = userId as any;
  this.acknowledgmentNote = note;
  return this.save();
};

// Assign alert
alertSchema.methods.assignTo = function(userId: string, assignedBy: string) {
  this.assignedTo = userId as any;
  this.assignedBy = assignedBy as any;
  this.assignedAt = new Date();
  return this.save();
};

// Resolve alert
alertSchema.methods.resolve = function(userId: string, resolution: any) {
  this.status = AlertStatus.RESOLVED;
  this.resolvedAt = new Date();
  this.resolvedBy = userId as any;
  this.resolution = resolution;
  return this.save();
};

// Escalate alert
alertSchema.methods.escalate = function(userId: string, reason: string) {
  this.status = AlertStatus.ESCALATED;
  this.escalatedTo = userId as any;
  this.escalatedAt = new Date();
  this.escalationReason = reason;
  this.escalationLevel += 1;
  return this.save();
};

// ============================================
// EXPORT
// ============================================

export const Alert = mongoose.model('Alert', alertSchema);
export default Alert;