/**
 * Evidence Model - Enhanced Enterprise Edition
 * Comprehensive digital forensic evidence management
 */

import mongoose, { Schema } from 'mongoose';

// ============================================
// EVIDENCE TYPE ENUM
// ============================================

export enum EvidenceType {
  FILE = 'file',
  MEMORY_DUMP = 'memory_dump',
  NETWORK_CAPTURE = 'network_capture',
  LOG = 'log',
  SCREENSHOT = 'screenshot',
  REGISTRY_DUMP = 'registry_dump',
  PROCESS_SNAPSHOT = 'process_snapshot',
  PACKAGE = 'package', // Compressed evidence package
  MALWARE_SAMPLE = 'malware_sample',
  REPORT = 'report',
  EXECUTABLE = 'executable', // .exe / binary artifact found in the forensic event
  DOCUMENT = 'document',     // pdf/docx artifact found in the forensic event
  URL = 'url',               // URL found in the forensic event (no file on disk)
  OTHER = 'other',
}

// ============================================
// EVIDENCE SOURCE ENUM
// ============================================

export enum EvidenceSource {
  MANUAL_UPLOAD = 'manual_upload',
  SANDBOX_EXECUTION = 'sandbox_execution',
  NETWORK_CAPTURE = 'network_capture',
  ENDPOINT_COLLECTION = 'endpoint_collection',
  IMPORTED = 'imported',
  API_RECEIVED = 'api_received',
}

// ============================================
// EVIDENCE STATUS ENUM
// ============================================

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

// ============================================
// CHAIN OF CUSTODY ENTRY
// ============================================

export interface ChainOfCustodyEntry {
  timestamp: Date;
  action: string;
  userId: string;
  userName: string;
  details: string;
  location?: string;
  hash?: string;
}

// ============================================
// FILE METADATA
// ============================================

export interface FileMetadata {
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  createdAt?: Date;
  modifiedAt?: Date;
  accessedAt?: Date;
  encoding?: string;
}

// ============================================
// EVIDENCE SCHEMA
// ============================================

const evidenceSchema = new Schema({
  // Core identification
  evidenceId: {
    type: String,
    required: true,
    unique: true,
  },

  // Investigation reference
  investigationId: {
    type: Schema.Types.ObjectId,
    ref: 'Investigation',
    required: true,
  },

  // Basic info
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  description: {
    type: String,
    maxlength: 10000,
  },

  // Classification
  type: {
    type: String,
    enum: Object.values(EvidenceType),
    default: EvidenceType.OTHER,
    index: true,
  },
  source: {
    type: String,
    enum: Object.values(EvidenceSource),
    default: EvidenceSource.MANUAL_UPLOAD,
  },
  status: {
    type: String,
    enum: Object.values(EvidenceStatus),
    default: EvidenceStatus.UPLOADING,
    index: true,
  },

  // Analysis target
  // - executable: suspected scenario family chosen at registration (auto-selects the sandbox simulator)
  // - document / url: analyzed statically via the analysis pipeline inside the Sandbox section
  simulatorHint: {
    type: String,
    trim: true,
  },
  url: {
    type: String,
    trim: true,
  },

  // File information (not required for URL evidence — URLs have no artifact on disk)
  filePath: {
    type: String,
    required: function(this: any) { return this.type !== EvidenceType.URL; },
  },
  fileName: {
    type: String,
    required: function(this: any) { return this.type !== EvidenceType.URL; },
  },
  fileSize: {
    type: Number,
    required: function(this: any) { return this.type !== EvidenceType.URL; },
  },
  mimeType: {
    type: String,
    required: function(this: any) { return this.type !== EvidenceType.URL; },
  },

  // Integrity hashes
  hash: {
    sha256: {
      type: String,
    },
    md5: String,
    sha1: String,
  },
  fingerprint: {
    type: String,
    index: true,
  },
  tamperedHash: {
    type: String,
  },
  fileMetadata: {
    originalName: String,
    extension: String,
    mimeType: String,
    size: Number,
    createdAt: Date,
    modifiedAt: Date,
    encoding: String,
  },

  // Ownership and tracking
  collectedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  collectedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  uploadedFrom: {
    ipAddress: String,
    hostname: String,
    agent: String,
  },

  // Verification
  verified: {
    type: Boolean,
    default: false,
  },
  verifiedAt: Date,
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'failed', 'modified'],
    default: 'pending',
  },

  // Chain of custody
  chainOfCustody: [{
    timestamp: {
      type: Date,
      default: Date.now,
    },
    action: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: String,
    details: String,
    location: String,
    hash: String,
  }],
  custodyComplete: {
    type: Boolean,
    default: false,
  },

  // Analysis
  analysisCompleted: {
    type: Boolean,
    default: false,
  },
  analysisSummary: String,
  // Stores the full AI analysis payload (session-shaped: threat_classification,
  // severity_score, behavioral_summary, ...) — Mixed so nothing is dropped.
  aiAnalysis: Schema.Types.Mixed,
  threatClassification: {
    category: String,
    family: String,
    severity: String,
  },

  // Retention
  retentionUntil: Date,
  archiveRequested: {
    type: Boolean,
    default: false,
  },
  archivedAt: Date,
  archiveLocation: String,

  // Tags and metadata
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  customMetadata: {
    type: Schema.Types.Mixed,
    // User-provided metadata (manual input)
  },
  metadata: {
    type: Schema.Types.Mixed,
    // System-generated metadata (auto-populated)
  },

  // External references
  externalIds: [String],
  sandboxSessionId: {
    type: Schema.Types.ObjectId,
    ref: 'SandboxSession',
  },
  originalReportId: {
    type: Schema.Types.ObjectId,
    ref: 'Report',
  },

  // Associated files (for packages)
  containsFiles: [{
    name: String,
    path: String,
    size: Number,
    hash: String,
  }],
  packageManifest: String,

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
evidenceSchema.index({ investigationId: 1, type: 1 });
evidenceSchema.index({ investigationId: 1, status: 1 });
evidenceSchema.index({ 'hash.sha256': 1 });
evidenceSchema.index({ tags: 1 });
evidenceSchema.index({ createdAt: -1 });
evidenceSchema.index({ collectedBy: 1, createdAt: -1 });
evidenceSchema.index({ verified: 1, status: 1 });
evidenceSchema.index({ source: 1, type: 1 });

// Text search
evidenceSchema.index({
  name: 'text',
  description: 'text',
  tags: 'text',
});

// ============================================
// METHODS
// ============================================

// Add chain of custody entry
evidenceSchema.methods.addCustodyEntry = function(
  action: string,
  userId: string,
  userName: string,
  details: string,
  location?: string
) {
  this.chainOfCustody.push({
    timestamp: new Date(),
    action,
    userId,
    userName,
    details,
    location,
  });
  return this.save();
};

// Verify integrity
evidenceSchema.methods.verify = function(userId: string) {
  this.verified = true;
  this.verifiedAt = new Date();
  this.verifiedBy = userId as any;
  this.verificationStatus = 'verified';
  return this.save();
};

// Mark as analyzed
evidenceSchema.methods.markAnalyzed = function(analysisSummary: string) {
  this.analysisCompleted = true;
  this.analysisSummary = analysisSummary;
  this.status = EvidenceStatus.VERIFIED;
  return this.save();
};

// ============================================
// EXPORT
// ============================================

export const Evidence = mongoose.model('Evidence', evidenceSchema);
export default Evidence;
