/**
 * Blockchain Types and Interfaces
 * Type definitions for blockchain evidence verification
 */

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  FAILED = 'failed',
  MODIFIED = 'modified',
  ON_CHAIN = 'on_chain',
  SYNCING = 'syncing',
}

export enum EvidenceIntegrityState {
  INTACT = 'intact',
  MODIFIED = 'modified',
  UNKNOWN = 'unknown',
  VERIFICATION_FAILED = 'verification_failed',
}

export enum SyncStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

export enum SyncOperation {
  EVIDENCE_REGISTER = 'evidence_register',
  EVIDENCE_VERIFY = 'evidence_verify',
  PACKAGE_CREATE = 'package_create',
  PACKAGE_VERIFY = 'package_verify',
}

export enum BlockchainEventType {
  EVIDENCE_REGISTERED = 'evidence_registered',
  EVIDENCE_VERIFIED = 'evidence_verified',
  VERIFICATION_FAILED = 'verification_failed',
  HASH_MISMATCH = 'hash_mismatch',
  TAMPER_DETECTED = 'tamper_detected',
  CHAIN_SYNC_COMPLETE = 'chain_sync_complete',
  EVIDENCE_REMOVED = 'evidence_removed',
}

export interface EvidenceFingerprint {
  evidenceId: string;
  fingerprint: string; // SHA-256 hash
  algorithm: 'sha256' | 'sha3-256';
  generatedAt: Date;
  generatedBy: string;
  previousFingerprint?: string;
  chainPosition: number;
}

export interface BlockchainVerification {
  id: string;
  evidenceId: string;
  fingerprint: string;
  transactionHash?: string;
  blockNumber?: number;
  blockTimestamp?: Date;
  status: VerificationStatus;
  verificationResult: boolean;
  verificationDetails?: string;
  verifiedAt: Date;
  verifiedBy: string;
  onChainTxId?: string;
}

export interface EvidenceIntegrityRecord {
  evidenceId: string;
  currentHash: string;
  previousHash?: string;
  integrityState: EvidenceIntegrityState;
  lastVerifiedAt: Date;
  lastVerificationStatus: VerificationStatus;
  verificationHistory: VerificationRecord[];
  tamperAlerts: TamperAlert[];
}

export interface VerificationRecord {
  id: string;
  evidenceId: string;
  timestamp: Date;
  hash: string;
  status: VerificationStatus;
  method: 'local' | 'blockchain' | 'both';
  verifiedBy: string;
  details?: string;
}

export interface TamperAlert {
  id: string;
  timestamp: Date;
  evidenceId: string;
  detectedAt: Date;
  expectedHash: string;
  actualHash: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  notes?: string;
}

export interface ChainOfCustodyBlock {
  entryId: string;
  evidenceId: string;
  action: string;
  userId: string;
  userName: string;
  timestamp: Date;
  hash: string;
  previousBlockHash: string;
  blockNumber: number;
}

export interface EvidencePackageHash {
  packageId: string;
  rootHash: string;
  evidenceHashes: string[];
  manifestHash: string;
  createdAt: Date;
  createdBy: string;
  verificationCount: number;
}

export interface BlockchainAuditEntry {
  id: string;
  timestamp: Date;
  eventType: BlockchainEventType;
  evidenceId?: string;
  transactionHash?: string;
  blockNumber?: number;
  details: string;
  performedBy: string;
  metadata?: Record<string, any>;
}

export interface Web3Transaction {
  to: string;
  from: string;
  value: string;
  data: string;
  gasLimit: number;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  chainId: number;
}

export interface SmartContractCall {
  contractAddress: string;
  functionName: string;
  parameters: any[];
  gasLimit?: number;
}

export interface VerificationBatchResult {
  batchId: string;
  totalEvidence: number;
  verifiedCount: number;
  failedCount: number;
  modifiedCount: number;
  results: VerificationResultItem[];
  completedAt: Date;
}

export interface VerificationResultItem {
  evidenceId: string;
  status: VerificationStatus;
  hash: string;
  integrityState: EvidenceIntegrityState;
  verificationTime: number;
  error?: string;
}
