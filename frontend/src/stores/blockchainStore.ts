/**
 * Blockchain Store - Frontend State Management
 * Zustand store for blockchain verification state
 */

import { create } from 'zustand';
import type {
  BlockchainStatus,
  VerificationStats,
  VerificationRecord,
  TamperAlert,
  VerificationResult,
  BatchVerificationResult,
  PackageVerificationResult,
  BlockchainAuditEntry,
  EvidenceIntegrityRecord,
  HashGenerationResult,
  HashVerificationResult,
} from '../types/blockchain';
import api from '../services/api';

// Transaction types
interface TransactionRecord {
  id: string;
  type: string;
  status: 'pending' | 'confirming' | 'confirmed' | 'failed' | 'retrying';
  transactionHash?: string;
  blockNumber?: number;
  confirmations: number;
  requiredConfirmations: number;
  gasUsed?: string;
  error?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

interface ContractEvidence {
  evidenceId: string;
  evidenceHash: string;
  timestamp: number;
  investigator: string;
  investigationId: string;
  verificationStatus: number;
}

// Sync types
interface SyncState {
  lastSyncTimestamp: string | null;
  lastSuccessfulSync: string | null;
  pendingOperations: number;
  failedOperations: number;
  totalSynced: number;
  blockchainConfirmed: number;
  syncHealth: 'healthy' | 'degraded' | 'unhealthy';
}

interface SyncQueueStatus {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
}

// Worker types
interface VerificationJob {
  id: string;
  type: 'single' | 'batch' | 'scheduled' | 'reconciliation';
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  evidenceIds: string[];
  userId: string;
  createdAt: string;
  progress: number;
  error?: string;
}

interface WorkerStats {
  totalJobs: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  byPriority: Record<string, number>;
}

// Reconciliation types
interface ReconciliationIssue {
  id: string;
  type: 'hash_mismatch' | 'orphan_record' | 'sync_failure' | 'transaction_failure' | 'drift_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidenceId?: string;
  description: string;
  detectedAt: string;
  resolved: boolean;
  resolution?: string;
}

interface ReconciliationStats {
  totalIssues: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  resolvedToday: number;
  autoResolved: number;
}

// Health types
interface HealthMetrics {
  score: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  blockchainConnection: boolean;
  verificationSuccessRate: number;
  syncQueueHealth: number;
  dataIntegrityScore: number;
  lastCheck: string;
  issues: string[];
}

interface BlockchainState {
  // Blockchain connection status
  status: BlockchainStatus | null;
  stats: VerificationStats | null;
  isLoading: boolean;
  error: string | null;

  // Verification data
  verificationHistory: Map<string, VerificationRecord[]>;
  tamperAlerts: TamperAlert[];
  integrityRecords: EvidenceIntegrityRecord[];
  auditLog: BlockchainAuditEntry[];

  // Transaction data
  transactions: TransactionRecord[];
  transactionStats: {
    total: number;
    pending: number;
    confirmed: number;
    failed: number;
    averageConfirmations: number;
  } | null;

  // Contract data
  contractEvidence: Map<string, ContractEvidence>;

  // Sync data
  syncState: SyncState | null;
  syncQueueStatus: SyncQueueStatus | null;

  // Worker data
  workerStats: WorkerStats | null;
  verificationJobs: Map<string, VerificationJob>;

  // Reconciliation data
  reconciliationIssues: ReconciliationIssue[];
  reconciliationStats: ReconciliationStats | null;

  // Health data
  healthMetrics: HealthMetrics | null;

  // Actions
  fetchStatus: () => Promise<void>;
  fetchStats: () => Promise<void>;
  verifyEvidence: (evidenceId: string, filePath: string, sourceType?: 'file' | 'url') => Promise<VerificationResult>;
  batchVerify: (evidenceItems: Array<{ evidenceId: string; filePath: string }>) => Promise<BatchVerificationResult>;
  createPackage: (
    investigationId: string,
    evidenceIds: string[],
    filePaths: string[]
  ) => Promise<void>;
  verifyPackage: (packageId: string) => Promise<PackageVerificationResult>;
  registerEvidence: (evidenceId: string, filePath: string) => Promise<void>;
  fetchAuditLog: (filters?: {
    evidenceId?: string;
    eventType?: string;
    startDate?: string;
    endDate?: string;
  }) => Promise<void>;
  fetchIntegrityRecords: (investigationId: string) => Promise<void>;
  fetchTamperAlerts: (unacknowledgedOnly?: boolean) => Promise<void>;
  acknowledgeAlert: (evidenceId: string, alertId: string, notes?: string) => Promise<void>;
  getVerificationHistory: (evidenceId: string) => Promise<void>;
  generateHash: (data: string) => Promise<HashGenerationResult>;
  verifyHash: (filePath: string, expectedHash: string) => Promise<HashVerificationResult>;
  clearError: () => void;

  // Contract operations
  registerOnContract: (evidenceId: string, evidenceHash: string, investigationId?: string) => Promise<TransactionRecord>;
  verifyOnContract: (evidenceId: string, hashToVerify: string) => Promise<TransactionRecord>;
  getContractEvidence: (evidenceId: string) => Promise<ContractEvidence | null>;
  checkContractEvidence: (evidenceId: string) => Promise<boolean>;

  // Transaction management
  fetchTransactions: (filters?: { status?: string; type?: string }) => Promise<void>;
  fetchTransactionStats: () => Promise<void>;
  retryTransaction: (txId: string) => Promise<TransactionRecord>;

  // Audit operations
  recordAuditEntry: (params: {
    category?: number;
    severity?: number;
    description: string;
    investigationId?: string;
    evidenceId?: string;
    metadata?: string;
  }) => Promise<TransactionRecord>;
  fetchEvidenceAuditFromChain: (evidenceId: string) => Promise<any[]>;

  // Tamper detection
  recordTamperDetection: (evidenceId: string, investigationId: string, expectedHash: string, actualHash: string) => Promise<any>;

  // Explorer
  getExplorerUrl: (txHash: string) => Promise<string>;

  // Sync operations
  fetchSyncStatus: () => Promise<void>;
  queueForSync: (evidenceId: string, fingerprint: string) => Promise<string>;
  processSyncQueue: () => Promise<{ processed: number; successful: number; failed: number }>;
  retryFailedSync: () => Promise<number>;
  checkConsistency: (evidenceId: string) => Promise<{ consistent: boolean; discrepancies: string[] }>;

  // Worker operations
  fetchWorkerStatus: () => Promise<void>;
  createVerificationJob: (type: string, evidenceIds: string[], priority?: string, filePaths?: string[]) => Promise<string>;
  getJobStatus: (jobId: string) => Promise<VerificationJob | null>;
  cancelJob: (jobId: string) => Promise<boolean>;

  // Reconciliation operations
  runReconciliation: () => Promise<any>;
  fetchReconciliationIssues: (severity?: string) => Promise<void>;
  resolveReconciliationIssue: (issueId: string, resolution: string) => Promise<boolean>;
  fetchReconciliationStats: () => Promise<void>;

  // State operations
  fetchBlockchainState: () => Promise<void>;
  fetchHealthMetrics: () => Promise<void>;
}

export const useBlockchainStore = create<BlockchainState>((set, get) => ({
  // Initial state
  status: null,
  stats: null,
  isLoading: false,
  error: null,
  verificationHistory: new Map(),
  tamperAlerts: [],
  integrityRecords: [],
  auditLog: [],
  transactions: [],
  transactionStats: null,
  contractEvidence: new Map(),
  syncState: null,
  syncQueueStatus: null,
  workerStats: null,
  verificationJobs: new Map(),
  reconciliationIssues: [],
  reconciliationStats: null,
  healthMetrics: null,

  // Fetch blockchain status
  fetchStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{ status: BlockchainStatus }>('/blockchain/status');
      if (response.success && response.data) {
        set({ status: response.data.status, isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch blockchain status' });
    }
  },

  // Fetch verification statistics
  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{ stats: VerificationStats }>('/blockchain/verification/stats');
      if (response.success && response.data) {
        set({ stats: response.data.stats, isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch verification stats' });
    }
  },

  // Verify single evidence
  verifyEvidence: async (evidenceId: string, filePath: string, sourceType: 'file' | 'url' = 'file'): Promise<VerificationResult> => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<{ verified: boolean; currentHash: string; status: string; integrityState: string }>('/blockchain/evidence/verify', {
        evidenceId,
        filePath,
        sourceType,
      });
      if (response.success && response.data) {
        const result: VerificationResult = {
          verified: response.data.verified,
          currentHash: response.data.currentHash,
          status: response.data.status as any,
          integrityState: response.data.integrityState as any,
        };
        // Update verification history
        const history = get().verificationHistory;
        history.set(evidenceId, []);
        set({ verificationHistory: new Map(history), isLoading: false });
        return result;
      }
      throw new Error('Verification failed');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to verify evidence' });
      throw error;
    }
  },

  // Batch verify evidence
  batchVerify: async (evidenceItems: { evidenceId: string; filePath: string }[]): Promise<BatchVerificationResult> => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<{ total: number; verified: number; modified: number; failed: number; results: any[] }>('/blockchain/evidence/batch-verify', { evidenceItems });
      if (response.success && response.data) {
        set({ isLoading: false });
        return response.data as any as BatchVerificationResult;
      }
      throw new Error('Batch verification failed');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to batch verify evidence' });
      throw error;
    }
  },

  // Create evidence package
  createPackage: async (investigationId, evidenceIds, filePaths) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/blockchain/package/create', {
        investigationId,
        evidenceIds,
        filePaths,
      });
      if (response.success) {
        set({ isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to create evidence package' });
      throw error;
    }
  },

  // Verify evidence package
  verifyPackage: async (packageId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/blockchain/package/verify', { packageId });
      if (response.success && response.data) {
        set({ isLoading: false });
        return response.data;
      }
      throw new Error('Package verification failed');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to verify package' });
      throw error;
    }
  },

  // Register evidence for blockchain
  registerEvidence: async (evidenceId, filePath) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/blockchain/evidence/register', { evidenceId, filePath });
      if (response.success) {
        set({ isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to register evidence' });
      throw error;
    }
  },

  // Fetch audit log
  fetchAuditLog: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.evidenceId) params.append('evidenceId', filters.evidenceId);
      if (filters?.eventType) params.append('eventType', filters.eventType);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);

      const response = await api.get(`/blockchain/audit?${params.toString()}`);
      if (response.success && response.data) {
        set({ auditLog: response.data.logs, isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch audit log' });
    }
  },

  // Fetch integrity records for investigation
  fetchIntegrityRecords: async (investigationId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/blockchain/integrity/${investigationId}`);
      if (response.success && response.data) {
        set({ integrityRecords: response.data.records, isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch integrity records' });
    }
  },

  // Fetch tamper alerts
  fetchTamperAlerts: async (unacknowledgedOnly = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/blockchain/alerts?unacknowledged=${unacknowledgedOnly}`);
      if (response.success && response.data) {
        set({ tamperAlerts: response.data.alerts, isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch tamper alerts' });
    }
  },

  // Acknowledge tamper alert
  acknowledgeAlert: async (evidenceId, alertId, notes) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/blockchain/alerts/${evidenceId}/${alertId}/acknowledge`, { notes });
      // Update local state
      const alerts = get().tamperAlerts.map((a) =>
        a.id === alertId ? { ...a, acknowledged: true, notes } : a
      );
      set({ tamperAlerts: alerts, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: 'Failed to acknowledge alert' });
      throw error;
    }
  },

  // Get verification history for evidence
  getVerificationHistory: async (evidenceId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/blockchain/verification/history/${evidenceId}`);
      if (response.success && response.data) {
        const history = get().verificationHistory;
        history.set(evidenceId, response.data.history);
        set({ verificationHistory: new Map(history), isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch verification history' });
    }
  },

  // Generate hash for data
  generateHash: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/blockchain/hash/generate', { data });
      if (response.success && response.data) {
        set({ isLoading: false });
        return response.data;
      }
      throw new Error('Hash generation failed');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to generate hash' });
      throw error;
    }
  },

  // Verify hash
  verifyHash: async (filePath, expectedHash) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/blockchain/hash/verify', { filePath, expectedHash });
      if (response.success && response.data) {
        set({ isLoading: false });
        return response.data;
      }
      throw new Error('Hash verification failed');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to verify hash' });
      throw error;
    }
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Register on smart contract
  registerOnContract: async (evidenceId, evidenceHash, investigationId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/blockchain/contract/register', {
        evidenceId,
        evidenceHash,
        investigationId,
      });
      if (response.success && response.data) {
        set({ isLoading: false });
        return response.data;
      }
      throw new Error('Contract registration failed');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to register on contract' });
      throw error;
    }
  },

  // Verify on smart contract
  verifyOnContract: async (evidenceId, hashToVerify) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/blockchain/contract/verify', {
        evidenceId,
        hashToVerify,
      });
      if (response.success && response.data) {
        set({ isLoading: false });
        return response.data;
      }
      throw new Error('Contract verification failed');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to verify on contract' });
      throw error;
    }
  },

  // Get contract evidence
  getContractEvidence: async (evidenceId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/blockchain/contract/evidence/${evidenceId}`);
      if (response.success && response.data) {
        const evidence = response.data.evidence;
        const map = get().contractEvidence;
        map.set(evidenceId, evidence);
        set({ contractEvidence: new Map(map), isLoading: false });
        return evidence;
      }
      return null;
    } catch (error) {
      set({ isLoading: false, error: 'Failed to get contract evidence' });
      return null;
    }
  },

  // Check contract evidence exists
  checkContractEvidence: async (evidenceId) => {
    try {
      const response = await api.get(`/blockchain/contract/exists/${evidenceId}`);
      if (response.success && response.data) {
        return response.data.exists;
      }
      return false;
    } catch {
      return false;
    }
  },

  // Fetch transactions
  fetchTransactions: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.type) params.append('type', filters.type);

      const response = await api.get(`/blockchain/transactions?${params.toString()}`);
      if (response.success && response.data) {
        set({ transactions: response.data.transactions, isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch transactions' });
    }
  },

  // Fetch transaction stats
  fetchTransactionStats: async () => {
    try {
      const response = await api.get('/blockchain/transactions/stats');
      if (response.success && response.data) {
        set({ transactionStats: response.data.stats });
      }
    } catch {
      // Ignore errors
    }
  },

  // Retry transaction
  retryTransaction: async (txId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/blockchain/transactions/${txId}/retry`);
      if (response.success && response.data) {
        set({ isLoading: false });
        return response.data;
      }
      throw new Error('Transaction retry failed');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to retry transaction' });
      throw error;
    }
  },

  // Record audit entry
  recordAuditEntry: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/blockchain/audit/record', params);
      if (response.success && response.data) {
        set({ isLoading: false });
        return response.data;
      }
      throw new Error('Audit recording failed');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to record audit entry' });
      throw error;
    }
  },

  // Fetch evidence audit from chain
  fetchEvidenceAuditFromChain: async (evidenceId) => {
    try {
      const response = await api.get(`/blockchain/audit/evidence/${evidenceId}`);
      if (response.success && response.data) {
        return response.data.auditEntries;
      }
      return [];
    } catch {
      return [];
    }
  },

  // Record tamper detection
  recordTamperDetection: async (evidenceId, investigationId, expectedHash, actualHash) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/blockchain/tamper/record', {
        evidenceId,
        investigationId,
        expectedHash,
        actualHash,
      });
      if (response.success) {
        set({ isLoading: false });
      }
      return response.data;
    } catch (error) {
      set({ isLoading: false, error: 'Failed to record tamper detection' });
      throw error;
    }
  },

  // Get explorer URL
  getExplorerUrl: async (txHash) => {
    try {
      const response = await api.get(`/blockchain/explorer/tx/${txHash}`);
      if (response.success && response.data) {
        return response.data.explorerUrl;
      }
      return '';
    } catch {
      return '';
    }
  },

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  // Fetch sync status
  fetchSyncStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/blockchain/sync/status');
      if (response.success && response.data) {
        set({
          syncState: response.data.state,
          syncQueueStatus: response.data.queueStatus,
          isLoading: false,
        });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch sync status' });
    }
  },

  // Queue evidence for sync
  queueForSync: async (evidenceId, fingerprint) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/blockchain/sync/queue', { evidenceId, fingerprint });
      if (response.success && response.data) {
        set({ isLoading: false });
        return response.data.syncId;
      }
      throw new Error('Failed to queue for sync');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to queue for sync' });
      throw error;
    }
  },

  // Process sync queue
  processSyncQueue: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/blockchain/sync/process');
      if (response.success && response.data) {
        set({ isLoading: false });
        return response.data;
      }
      throw new Error('Failed to process sync queue');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to process sync queue' });
      throw error;
    }
  },

  // Retry failed sync
  retryFailedSync: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/blockchain/sync/retry');
      if (response.success && response.data) {
        set({ isLoading: false });
        return response.data.retryCount;
      }
      throw new Error('Failed to retry sync');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to retry sync' });
      throw error;
    }
  },

  // Check evidence consistency
  checkConsistency: async (evidenceId) => {
    try {
      const response = await api.get(`/blockchain/sync/consistency/${evidenceId}`);
      if (response.success && response.data) {
        return response.data;
      }
      return { consistent: false, discrepancies: ['Failed to check consistency'] };
    } catch {
      return { consistent: false, discrepancies: ['Failed to check consistency'] };
    }
  },

  // ============================================
  // WORKER OPERATIONS
  // ============================================

  // Fetch worker status
  fetchWorkerStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/blockchain/worker/status');
      if (response.success && response.data) {
        set({
          workerStats: response.data.queueStatus,
          isLoading: false,
        });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch worker status' });
    }
  },

  // Create verification job
  createVerificationJob: async (type, evidenceIds, priority, filePaths) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/blockchain/worker/job', {
        type,
        evidenceIds,
        priority: priority || 'normal',
        filePaths,
      });
      if (response.success && response.data) {
        set({ isLoading: false });
        return response.data.jobId;
      }
      throw new Error('Failed to create verification job');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to create verification job' });
      throw error;
    }
  },

  // Get job status
  getJobStatus: async (jobId) => {
    try {
      const response = await api.get(`/blockchain/worker/job/${jobId}`);
      if (response.success && response.data) {
        const job = response.data.job;
        const jobs = get().verificationJobs;
        jobs.set(jobId, job);
        set({ verificationJobs: new Map(jobs) });
        return job;
      }
      return null;
    } catch {
      return null;
    }
  },

  // Cancel job
  cancelJob: async (jobId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/blockchain/worker/job/${jobId}/cancel`);
      if (response.success) {
        set({ isLoading: false });
        return true;
      }
      return false;
    } catch (error) {
      set({ isLoading: false, error: 'Failed to cancel job' });
      return false;
    }
  },

  // ============================================
  // RECONCILIATION OPERATIONS
  // ============================================

  // Run reconciliation
  runReconciliation: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/blockchain/reconciliation/run');
      if (response.success && response.data) {
        set({ isLoading: false });
        return response.data.report;
      }
      throw new Error('Reconciliation failed');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to run reconciliation' });
      throw error;
    }
  },

  // Fetch reconciliation issues
  fetchReconciliationIssues: async (severity) => {
    set({ isLoading: true, error: null });
    try {
      const params = severity ? `?severity=${severity}` : '';
      const response = await api.get(`/blockchain/reconciliation/issues${params}`);
      if (response.success && response.data) {
        set({ reconciliationIssues: response.data.issues, isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch reconciliation issues' });
    }
  },

  // Resolve reconciliation issue
  resolveReconciliationIssue: async (issueId, resolution) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/blockchain/reconciliation/issues/${issueId}/resolve`, { resolution });
      if (response.success) {
        // Update local state
        const issues = get().reconciliationIssues.map((i) =>
          i.id === issueId ? { ...i, resolved: true, resolution } : i
        );
        set({ reconciliationIssues: issues, isLoading: false });
        return true;
      }
      return false;
    } catch (error) {
      set({ isLoading: false, error: 'Failed to resolve issue' });
      return false;
    }
  },

  // Fetch reconciliation stats
  fetchReconciliationStats: async () => {
    try {
      const response = await api.get('/blockchain/reconciliation/stats');
      if (response.success && response.data) {
        set({ reconciliationStats: response.data.stats });
      }
    } catch {
      // Ignore errors
    }
  },

  // ============================================
  // STATE OPERATIONS
  // ============================================

  // Fetch blockchain state
  fetchBlockchainState: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/blockchain/state');
      if (response.success && response.data) {
        set({ isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch blockchain state' });
    }
  },

  // Fetch health metrics
  fetchHealthMetrics: async () => {
    try {
      const response = await api.get('/blockchain/state/health');
      if (response.success && response.data) {
        set({ healthMetrics: response.data.health });
      }
    } catch {
      // Ignore errors
    }
  },
}));