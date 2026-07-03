/**
 * Blockchain Evidence Model
 * MongoDB schema for blockchain-verified evidence records
 */

import mongoose, { Schema } from 'mongoose';
import {
  VerificationStatus,
  EvidenceIntegrityState as CoreEvidenceIntegrityState,
} from '../types';

// ============================================
// VERIFICATION STATUS ENUM
// ============================================

export const BlockchainVerificationStatus = VerificationStatus;
export type BlockchainVerificationStatus = VerificationStatus;

// ============================================
// EVIDENCE INTEGRITY STATE
// ============================================

export const EvidenceIntegrityState = CoreEvidenceIntegrityState;
export type EvidenceIntegrityState = CoreEvidenceIntegrityState;

// ============================================
// VERIFICATION RECORD
// ============================================

const verificationRecordSchema = new Schema({
  id: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  hash: { type: String, required: true },
  status: {
    type: String,
    enum: Object.values(BlockchainVerificationStatus),
    required: true,
  },
  method: {
    type: String,
    enum: ['local', 'blockchain', 'both'],
    default: 'local',
  },
  verifiedBy: { type: String, required: true },
  details: String,
}, { _id: false });

// ============================================
// TAMPER ALERT
// ============================================

const tamperAlertSchema = new Schema({
  id: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  evidenceId: { type: String, required: true },
  detectedAt: { type: Date, required: true },
  expectedHash: { type: String, required: true },
  actualHash: { type: String, required: true },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'critical',
  },
  acknowledged: { type: Boolean, default: false },
  acknowledgedBy: String,
  acknowledgedAt: Date,
  notes: String,
}, { _id: false });

// ============================================
// BLOCKCHAIN VERIFICATION SCHEMA
// ============================================

const blockchainVerificationSchema = new Schema({
  evidenceId: {
    type: String,
    required: true,
    index: true,
  },

  // Evidence fingerprint
  fingerprint: {
    type: String,
    required: true,
    index: true,
  },
  algorithm: {
    type: String,
    enum: ['sha256', 'sha3-256'],
    default: 'sha256',
  },

  // Blockchain verification
  transactionHash: {
    type: String,
    index: true,
  },
  blockNumber: Number,
  blockTimestamp: Date,
  chainId: Number,

  // Status
  status: {
    type: String,
    enum: Object.values(BlockchainVerificationStatus),
    default: BlockchainVerificationStatus.PENDING,
    index: true,
  },

  // Verification result
  verificationResult: {
    type: Boolean,
    default: false,
  },
  verificationDetails: String,

  // Metadata
  verifiedAt: Date,
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },

  // Previous chain reference
  previousFingerprint: String,
  chainPosition: {
    type: Number,
    default: 0,
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
// EVIDENCE INTEGRITY RECORD SCHEMA
// ============================================

const evidenceIntegritySchema = new Schema({
  evidenceId: {
    type: String,
    required: true,
    unique: true,
  },

  // Hash information
  currentHash: {
    type: String,
    required: true,
    index: true,
  },
  previousHash: String,

  // Integrity state
  integrityState: {
    type: String,
    enum: Object.values(EvidenceIntegrityState),
    default: EvidenceIntegrityState.UNKNOWN,
  },

  // Verification tracking
  lastVerifiedAt: Date,
  lastVerificationStatus: {
    type: String,
    enum: Object.values(BlockchainVerificationStatus),
  },

  // History
  verificationHistory: [verificationRecordSchema],
  tamperAlerts: [tamperAlertSchema],

  // Blockchain links
  blockchainVerified: {
    type: Boolean,
    default: false,
  },
  blockchainTxHash: String,
  blockchainBlockNumber: Number,

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
// BLOCKCHAIN AUDIT LOG SCHEMA
// ============================================

const blockchainAuditSchema = new Schema({
  evidenceId: {
    type: String,
    index: true,
  },

  // Event information
  eventType: {
    type: String,
    required: true,
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },

  // Transaction info
  transactionHash: String,
  blockNumber: Number,

  // Details
  details: {
    type: String,
    required: true,
  },

  // Performed by
  performedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Metadata
  metadata: Schema.Types.Mixed,

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
// EVIDENCE PACKAGE HASH SCHEMA
// ============================================

const evidencePackageHashSchema = new Schema({
  packageId: {
    type: String,
    required: true,
    unique: true,
  },

  // Investigation reference
  investigationId: {
    type: Schema.Types.ObjectId,
    ref: 'Investigation',
    required: true,
    index: true,
  },

  // Package hashes
  rootHash: {
    type: String,
    required: true,
  },
  evidenceHashes: [{
    evidenceId: String,
    hash: String,
    fileName: String,
  }],
  manifestHash: String,

  // Metadata
  evidenceCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Verification
  verificationCount: {
    type: Number,
    default: 0,
  },
  lastVerifiedAt: Date,
  lastVerificationStatus: {
    type: String,
    enum: Object.values(BlockchainVerificationStatus),
  },

  // Blockchain
  blockchainRegistered: {
    type: Boolean,
    default: false,
  },
  transactionHash: String,
  blockNumber: Number,

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

export const BlockchainVerification = mongoose.model(
  'BlockchainVerification',
  blockchainVerificationSchema
);

export const EvidenceIntegrity = mongoose.model(
  'EvidenceIntegrity',
  evidenceIntegritySchema
);

export const BlockchainAudit = mongoose.model(
  'BlockchainAudit',
  blockchainAuditSchema
);

export const EvidencePackageHash = mongoose.model(
  'EvidencePackageHash',
  evidencePackageHashSchema
);

// ============================================
// INDEXES
// ============================================

blockchainAuditSchema.index({ evidenceId: 1, eventType: 1 });
blockchainAuditSchema.index({ timestamp: -1 });
blockchainAuditSchema.index({ transactionHash: 1 });

evidenceIntegritySchema.index({ integrityState: 1 });
evidenceIntegritySchema.index({ lastVerifiedAt: -1 });

evidencePackageHashSchema.index({ rootHash: 1 });

blockchainVerificationSchema.index({ fingerprint: 1, status: 1 });
blockchainVerificationSchema.index({ blockNumber: -1 });

export default {
  BlockchainVerification,
  EvidenceIntegrity,
  BlockchainAudit,
  EvidencePackageHash,
};
