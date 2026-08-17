/**
 * Chain of Custody Model
 * Immutable evidence tracking and custody chain management
 */

import mongoose, { Schema } from 'mongoose';

// ============================================
// CUSTODY EVENT TYPES
// ============================================

export enum CustodyEventType {
  EVIDENCE_CREATED = 'evidence_created',
  EVIDENCE_UPLOADED = 'evidence_uploaded',
  VERIFICATION_REGISTERED = 'verification_registered',
  BLOCKCHAIN_SYNCED = 'blockchain_synced',
  INVESTIGATION_LINKED = 'investigation_linked',
  ANALYST_ACCESSED = 'analyst_accessed',
  INTEGRITY_CHECKED = 'integrity_checked',
  VERIFICATION_COMPLETED = 'verification_completed',
  VERIFICATION_FAILED = 'verification_failed',
  TAMPER_DETECTED = 'tamper_detected',
  EVIDENCE_MODIFIED = 'evidence_modified',
  EVIDENCE_EXPORTED = 'evidence_exported',
  EVIDENCE_ARCHIVED = 'evidence_archived',
  CUSTODY_TRANSFERRED = 'custody_transferred',
  BLOCKCHAIN_CONFIRMED = 'blockchain_confirmed',
  RECONCILIATION_COMPLETED = 'reconciliation_completed',
}

export enum IntegrityStatus {
  VERIFIED = 'verified',
  PENDING_VERIFICATION = 'pending_verification',
  SYNCING = 'syncing',
  INTEGRITY_MISMATCH = 'integrity_mismatch',
  TAMPER_SUSPECTED = 'tamper_suspected',
  VERIFICATION_FAILED = 'verification_failed',
  BLOCKCHAIN_UNAVAILABLE = 'blockchain_unavailable',
}

// ============================================
// CUSTODY EVENT SCHEMA
// ============================================

const custodyEventSchema = new Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  evidenceId: {
    type: String,
    required: true,
    index: true,
  },

  eventType: {
    type: String,
    enum: Object.values(CustodyEventType),
    required: true,
  },

  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },

  performedBy: {
    type: String,
    required: true,
  },

  performedByName: {
    type: String,
    required: true,
  },

  // Event details
  details: {
    type: String,
    required: true,
  },

  // Related entities
  investigationId: {
    type: Schema.Types.ObjectId,
    ref: 'Investigation',
  },

  transactionHash: String,
  blockNumber: Number,

  // Integrity state at event time
  integrityStatus: {
    type: String,
    enum: Object.values(IntegrityStatus),
  },

  previousEventHash: String,
  currentEventHash: String,

  // Metadata
  metadata: {
    ipAddress: String,
    userAgent: String,
    location: String,
    deviceId: String,
  },

}, { _id: false });

// ============================================
// CHAIN OF CUSTODY SCHEMA
// ============================================

const chainOfCustodySchema = new Schema({
  evidenceId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  chainId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Current state
  currentHolder: {
    type: String,
  },

  currentHolderName: String,

  custodyStatus: {
    type: String,
    enum: ['active', 'transferred', 'archived'],
    default: 'active',
  },

  // Integrity
  integrityStatus: {
    type: String,
    enum: Object.values(IntegrityStatus),
    default: IntegrityStatus.PENDING_VERIFICATION,
  },

  lastIntegrityCheck: Date,
  lastVerifiedAt: Date,

  // Blockchain
  blockchainVerified: {
    type: Boolean,
    default: false,
  },

  blockchainTxHash: String,
  blockchainBlockNumber: Number,

  // Chain events
  events: [custodyEventSchema],

  // Statistics
  eventCount: {
    type: Number,
    default: 0,
  },

  verificationCount: {
    type: Number,
    default: 0,
  },

  lastEventAt: Date,

  // Hash chain for immutability
  chainHash: {
    type: String,
    index: true,
  },

  genesisHash: String,

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
// EVIDENCE LINEAGE SCHEMA
// ============================================

const evidenceLineageSchema = new Schema({
  evidenceId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Parent evidence (if derived)
  parentEvidenceId: {
    type: String,
    index: true,
  },

  // Child evidence (evidence derived from this)
  childEvidenceIds: [{
    type: String,
  }],

  // Lineage type
  lineageType: {
    type: String,
    enum: ['original', 'derived', 'extracted', 'processed', 'correlated'],
    default: 'original',
  },

  // Creation context
  derivationMethod: String,
  extractionSource: String,

  // Linked telemetry
  linkedTelemetryIds: [{
    type: Schema.Types.ObjectId,
    ref: 'TelemetryEvent',
  }],

  // Linked IOCs
  linkedIocIds: [{
    type: Schema.Types.ObjectId,
    ref: 'IOC',
  }],

  // AI analysis linkage
  analysisJobId: String,
  analysisConfidence: Number,

  // Visualization position
  graphPosition: {
    x: Number,
    y: Number,
  },

  // Cluster info
  clusterId: String,
  clusterLabel: String,

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
// VERIFICATION HISTORY SCHEMA
// ============================================

const verificationHistorySchema = new Schema({
  verificationId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  evidenceId: {
    type: String,
    required: true,
    index: true,
  },

  verificationType: {
    type: String,
    enum: ['hash', 'blockchain', 'integrity', 'reconciliation'],
    required: true,
  },

  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },

  performedBy: {
    type: String,
  },

  performedByName: String,

  // Result
  status: {
    type: String,
    enum: ['success', 'failed', 'pending', 'mismatch'],
    required: true,
  },

  expectedHash: String,
  actualHash: String,
  hashMatch: Boolean,

  // Blockchain
  transactionHash: String,
  blockNumber: Number,
  confirmations: Number,

  // Details
  verificationTime: Number,
  details: String,

  // Reconciliation
  reconciliationIssueId: String,

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
// TAMPER INVESTIGATION SCHEMA
// ============================================

const tamperInvestigationSchema = new Schema({
  investigationId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  evidenceId: {
    type: String,
    required: true,
    index: true,
  },

  // Detection info
  detectedAt: {
    type: Date,
    default: Date.now,
  },

  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
  },

  // Mismatch details
  expectedHash: String,
  actualHash: String,

  // Investigation
  status: {
    type: String,
    enum: ['open', 'investigating', 'resolved', 'false_positive', 'escalated'],
    default: 'open',
  },

  assignedTo: {
    type: String,
  },

  assignedToName: String,

  // Timeline
  events: [{
    timestamp: Date,
    action: String,
    performedBy: String,
    notes: String,
  }],

  // Findings
  findings: String,
  conclusion: String,

  // Related
  relatedAlerts: [String],
  linkedInvestigations: [{
    type: Schema.Types.ObjectId,
    ref: 'Investigation',
  }],

  // Evidence drift analysis
  driftAnalysis: {
    firstDetectedAt: Date,
    lastConfirmedAt: Date,
    driftCount: Number,
    driftPattern: String,
  },

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
// EXPORTABLE VERIFICATION REPORT SCHEMA
// ============================================

const verificationReportSchema = new Schema({
  reportId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  investigationId: {
    type: Schema.Types.ObjectId,
    ref: 'Investigation',
  },

  evidenceIds: [{
    type: String,
  }],

  // Report metadata
  reportType: {
    type: String,
    enum: ['integrity_report', 'chain_of_custody', 'tamper_analysis', 'full_forensic'],
    required: true,
  },

  generatedAt: {
    type: Date,
    default: Date.now,
  },

  generatedBy: {
    type: String,
    required: true,
  },

  generatedByName: String,

  // Summary
  summary: {
    totalEvidence: Number,
    verifiedEvidence: Number,
    failedEvidence: Number,
    pendingEvidence: Number,
    tamperDetected: Number,
  },

  // Content
  content: {
    evidenceDetails: [{
      evidenceId: String,
      fileName: String,
      sha256Hash: String,
      integrityStatus: String,
      blockchainVerified: Boolean,
      lastVerifiedAt: Date,
    }],
    custodyTimeline: [{
      evidenceId: String,
      events: [custodyEventSchema],
    }],
    tamperAlerts: [{
      evidenceId: String,
      severity: String,
      description: String,
    }],
    blockchainReferences: [{
      evidenceId: String,
      transactionHash: String,
      blockNumber: Number,
    }],
  },

  // Signatures
  reportHash: String,
  digitalSignature: String,

  // Export
  exportedAt: Date,
  exportedBy: String,
  exportFormat: String,

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
// CREATE MODELS
// ============================================

export const ChainOfCustody = mongoose.model('ChainOfCustody', chainOfCustodySchema);
export const EvidenceLineage = mongoose.model('EvidenceLineage', evidenceLineageSchema);
export const VerificationHistory = mongoose.model('VerificationHistory', verificationHistorySchema);
export const TamperInvestigation = mongoose.model('TamperInvestigation', tamperInvestigationSchema);
export const VerificationReport = mongoose.model('VerificationReport', verificationReportSchema);

export default {
  ChainOfCustody,
  EvidenceLineage,
  VerificationHistory,
  TamperInvestigation,
  VerificationReport,
};