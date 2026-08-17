/**
 * Blockchain Routes
 * API endpoints for blockchain verification
 */

import { Router } from 'express';
import { authenticate, authorize } from '../../middleware';
import { blockchainController } from '../controllers/blockchain.controller';

const router = Router();

/**
 * @route   GET /api/v1/blockchain/status
 * @desc    Get blockchain connection status
 * @access  Private (Authenticated)
 */
router.get('/status', authenticate, blockchainController.getStatus);

/**
 * @route   GET /api/v1/blockchain/verification/stats
 * @desc    Get verification statistics
 * @access  Private (Authenticated)
 */
router.get('/verification/stats', authenticate, blockchainController.getVerificationStats);

/**
 * @route   POST /api/v1/blockchain/evidence/register
 * @desc    Register evidence for blockchain verification
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/evidence/register',
  authenticate,
  authorize(['super_admin', 'admin', 'analyst']),
  blockchainController.registerEvidence
);

/**
 * @route   POST /api/v1/blockchain/evidence/verify
 * @desc    Verify evidence integrity
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/evidence/verify',
  authenticate,
  authorize(['super_admin', 'admin', 'analyst']),
  blockchainController.verifyEvidence
);

/**
 * @route   POST /api/v1/blockchain/evidence/batch-verify
 * @desc    Batch verify multiple evidence items
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/evidence/batch-verify',
  authenticate,
  authorize(['super_admin', 'admin', 'analyst']),
  blockchainController.batchVerify
);

/**
 * @route   POST /api/v1/blockchain/package/create
 * @desc    Create evidence package hash
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/package/create',
  authenticate,
  authorize(['super_admin', 'admin', 'analyst']),
  blockchainController.createPackage
);

/**
 * @route   POST /api/v1/blockchain/package/verify
 * @desc    Verify evidence package
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/package/verify',
  authenticate,
  authorize(['super_admin', 'admin', 'analyst']),
  blockchainController.verifyPackage
);

/**
 * @route   GET /api/v1/blockchain/audit
 * @desc    Get blockchain audit log
 * @access  Private (Authenticated, Admin)
 */
router.get('/audit', authenticate, authorize(['super_admin', 'admin']), blockchainController.getAuditLog);

/**
 * @route   GET /api/v1/blockchain/integrity/:investigationId
 * @desc    Get integrity records for investigation
 * @access  Private (Authenticated)
 */
router.get(
  '/integrity/:investigationId',
  authenticate,
  blockchainController.getInvestigationIntegrity
);

/**
 * @route   GET /api/v1/blockchain/alerts
 * @desc    Get tamper alerts
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.get(
  '/alerts',
  authenticate,
  authorize(['super_admin', 'admin', 'analyst']),
  blockchainController.getTamperAlerts
);

/**
 * @route   POST /api/v1/blockchain/alerts/:evidenceId/:alertId/acknowledge
 * @desc    Acknowledge tamper alert
 * @access  Private (Authenticated, Admin)
 */
router.post(
  '/alerts/:evidenceId/:alertId/acknowledge',
  authenticate,
  authorize(['super_admin', 'admin']),
  blockchainController.acknowledgeAlert
);

/**
 * @route   GET /api/v1/blockchain/verification/history/:evidenceId
 * @desc    Get verification history for evidence
 * @access  Private (Authenticated)
 */
router.get(
  '/verification/history/:evidenceId',
  authenticate,
  blockchainController.getVerificationHistory
);

/**
 * @route   POST /api/v1/blockchain/hash/generate
 * @desc    Generate hash for raw data
 * @access  Private (Authenticated)
 */
router.post('/hash/generate', authenticate, blockchainController.generateHash);

/**
 * @route   POST /api/v1/blockchain/hash/verify
 * @desc    Verify hash matches expected
 * @access  Private (Authenticated)
 */
router.post('/hash/verify', authenticate, blockchainController.verifyHash);

// ============================================
// SMART CONTRACT OPERATIONS
// ============================================

/**
 * @route   POST /api/v1/blockchain/contract/register
 * @desc    Register evidence on smart contract
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/contract/register',
  authenticate,
  authorize(['super_admin', 'admin', 'analyst']),
  blockchainController.registerOnContract
);

/**
 * @route   POST /api/v1/blockchain/contract/verify
 * @desc    Verify evidence on smart contract
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/contract/verify',
  authenticate,
  authorize(['super_admin', 'admin', 'analyst']),
  blockchainController.verifyOnContract
);

/**
 * @route   GET /api/v1/blockchain/contract/evidence/:evidenceId
 * @desc    Get evidence info from smart contract
 * @access  Private (Authenticated)
 */
router.get(
  '/contract/evidence/:evidenceId',
  authenticate,
  blockchainController.getContractEvidence
);

/**
 * @route   GET /api/v1/blockchain/contract/exists/:evidenceId
 * @desc    Check if evidence exists on blockchain
 * @access  Private (Authenticated)
 */
router.get(
  '/contract/exists/:evidenceId',
  authenticate,
  blockchainController.checkContractEvidence
);

// ============================================
// TRANSACTION MANAGEMENT
// ============================================

/**
 * @route   GET /api/v1/blockchain/transactions
 * @desc    Get transaction history
 * @access  Private (Authenticated)
 */
router.get('/transactions', authenticate, blockchainController.getTransactions);

/**
 * @route   GET /api/v1/blockchain/transactions/stats
 * @desc    Get transaction statistics
 * @access  Private (Authenticated)
 */
router.get('/transactions/stats', authenticate, blockchainController.getTransactionStats);

/**
 * @route   POST /api/v1/blockchain/transactions/:txId/retry
 * @desc    Retry failed transaction
 * @access  Private (Authenticated, Admin)
 */
router.post(
  '/transactions/:txId/retry',
  authenticate,
  authorize(['super_admin', 'admin']),
  blockchainController.retryTransaction
);

// ============================================
// AUDIT OPERATIONS
// ============================================

/**
 * @route   POST /api/v1/blockchain/audit/record
 * @desc    Record audit entry on blockchain
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/audit/record',
  authenticate,
  authorize(['super_admin', 'admin', 'analyst']),
  blockchainController.recordAuditEntry
);

/**
 * @route   GET /api/v1/blockchain/audit/evidence/:evidenceId
 * @desc    Get audit entries for evidence from blockchain
 * @access  Private (Authenticated)
 */
router.get(
  '/audit/evidence/:evidenceId',
  authenticate,
  blockchainController.getEvidenceAuditFromChain
);

// ============================================
// TAMPER DETECTION
// ============================================

/**
 * @route   POST /api/v1/blockchain/tamper/record
 * @desc    Record tamper detection on blockchain
 * @access  Private (Authenticated, Admin)
 */
router.post(
  '/tamper/record',
  authenticate,
  authorize(['super_admin', 'admin']),
  blockchainController.recordTamperDetection
);

// ============================================
// BLOCKCHAIN EXPLORER
// ============================================

/**
 * @route   GET /api/v1/blockchain/explorer/tx/:txHash
 * @desc    Get explorer URL for transaction
 * @access  Private (Authenticated)
 */
router.get(
  '/explorer/tx/:txHash',
  authenticate,
  blockchainController.getExplorerUrl
);

// ============================================
// SYNCHRONIZATION OPERATIONS
// ============================================

/**
 * @route   GET /api/v1/blockchain/sync/status
 * @desc    Get synchronization status
 * @access  Private (Authenticated)
 */
router.get('/sync/status', authenticate, blockchainController.getSyncStatus);

/**
 * @route   POST /api/v1/blockchain/sync/queue
 * @desc    Queue evidence for blockchain sync
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/sync/queue',
  authenticate,
  authorize(['super_admin', 'admin', 'analyst']),
  blockchainController.queueForSync
);

/**
 * @route   POST /api/v1/blockchain/sync/process
 * @desc    Process synchronization queue
 * @access  Private (Authenticated, Admin)
 */
router.post(
  '/sync/process',
  authenticate,
  authorize(['super_admin', 'admin']),
  blockchainController.processSyncQueue
);

/**
 * @route   POST /api/v1/blockchain/sync/retry
 * @desc    Retry failed sync operations
 * @access  Private (Authenticated, Admin)
 */
router.post(
  '/sync/retry',
  authenticate,
  authorize(['super_admin', 'admin']),
  blockchainController.retryFailedSync
);

/**
 * @route   GET /api/v1/blockchain/sync/consistency/:evidenceId
 * @desc    Check evidence-chain consistency
 * @access  Private (Authenticated)
 */
router.get(
  '/sync/consistency/:evidenceId',
  authenticate,
  blockchainController.checkConsistency
);

// ============================================
// VERIFICATION WORKER OPERATIONS
// ============================================

/**
 * @route   GET /api/v1/blockchain/worker/status
 * @desc    Get verification worker status
 * @access  Private (Authenticated)
 */
router.get('/worker/status', authenticate, blockchainController.getWorkerStatus);

/**
 * @route   POST /api/v1/blockchain/worker/job
 * @desc    Create verification job
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/worker/job',
  authenticate,
  authorize(['super_admin', 'admin', 'analyst']),
  blockchainController.createVerificationJob
);

/**
 * @route   GET /api/v1/blockchain/worker/job/:jobId
 * @desc    Get verification job status
 * @access  Private (Authenticated)
 */
router.get(
  '/worker/job/:jobId',
  authenticate,
  blockchainController.getJobStatus
);

/**
 * @route   POST /api/v1/blockchain/worker/job/:jobId/cancel
 * @desc    Cancel verification job
 * @access  Private (Authenticated, Admin)
 */
router.post(
  '/worker/job/:jobId/cancel',
  authenticate,
  authorize(['super_admin', 'admin']),
  blockchainController.cancelJob
);

/**
 * @route   POST /api/v1/blockchain/worker/schedule
 * @desc    Create verification schedule
 * @access  Private (Authenticated, Admin)
 */
router.post(
  '/worker/schedule',
  authenticate,
  authorize(['super_admin', 'admin']),
  blockchainController.createSchedule
);

// ============================================
// RECONCILIATION OPERATIONS
// ============================================

/**
 * @route   POST /api/v1/blockchain/reconciliation/run
 * @desc    Run full reconciliation
 * @access  Private (Authenticated, Admin)
 */
router.post(
  '/reconciliation/run',
  authenticate,
  authorize(['super_admin', 'admin']),
  blockchainController.runReconciliation
);

/**
 * @route   GET /api/v1/blockchain/reconciliation/issues
 * @desc    Get active reconciliation issues
 * @access  Private (Authenticated)
 */
router.get('/reconciliation/issues', authenticate, blockchainController.getReconciliationIssues);

/**
 * @route   POST /api/v1/blockchain/reconciliation/issues/:issueId/resolve
 * @desc    Resolve reconciliation issue
 * @access  Private (Authenticated, Admin)
 */
router.post(
  '/reconciliation/issues/:issueId/resolve',
  authenticate,
  authorize(['super_admin', 'admin']),
  blockchainController.resolveIssue
);

/**
 * @route   GET /api/v1/blockchain/reconciliation/stats
 * @desc    Get reconciliation statistics
 * @access  Private (Authenticated)
 */
router.get('/reconciliation/stats', authenticate, blockchainController.getReconciliationStats);

/**
 * @route   GET /api/v1/blockchain/reconciliation/check/:evidenceId
 * @desc    Check specific evidence consistency
 * @access  Private (Authenticated)
 */
router.get(
  '/reconciliation/check/:evidenceId',
  authenticate,
  blockchainController.checkEvidenceReconciliation
);

// ============================================
// STATE TRACKING OPERATIONS
// ============================================

/**
 * @route   GET /api/v1/blockchain/state
 * @desc    Get blockchain state
 * @access  Private (Authenticated)
 */
router.get('/state', authenticate, blockchainController.getBlockchainState);

/**
 * @route   GET /api/v1/blockchain/state/health
 * @desc    Get health metrics
 * @access  Private (Authenticated)
 */
router.get('/state/health', authenticate, blockchainController.getHealthMetrics);

/**
 * @route   GET /api/v1/blockchain/state/metrics
 * @desc    Get performance metrics
 * @access  Private (Authenticated)
 */
router.get('/state/metrics', authenticate, blockchainController.getPerformanceMetrics);

/**
 * @route   GET /api/v1/blockchain/state/operations
 * @desc    Get operation history
 * @access  Private (Authenticated, Admin)
 */
router.get(
  '/state/operations',
  authenticate,
  authorize(['super_admin', 'admin']),
  blockchainController.getOperationHistory
);

export default router;