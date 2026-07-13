/**
 * Blockchain Controller
 * Handles blockchain verification endpoints
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware';
import { ApiResponse } from '../../types';
import { blockchainVerificationService } from '../verification-orchestrator.service';
import { verificationService } from '../verification.service';
import { blockchainService } from '../blockchain.service';
import { blockchainSyncService } from '../synchronization.service';
import { distributedVerificationService } from '../verification-worker.service';
import { blockchainReconciliationService } from '../reconciliation.service';
import { blockchainStateTrackingService } from '../state-tracking.service';

export class BlockchainController {
  /**
   * GET /api/v1/blockchain/status
   * Get blockchain connection status
   */
  async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const status = await blockchainVerificationService.getBlockchainStatus();

      const response: ApiResponse = {
        success: true,
        message: 'Blockchain status retrieved',
        data: { status },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get blockchain status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/verification/stats
   * Get verification statistics
   */
  async getVerificationStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const stats = await blockchainVerificationService.getVerificationStats();

      const response: ApiResponse = {
        success: true,
        message: 'Verification statistics retrieved',
        data: { stats },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get verification statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/evidence/register
   * Register evidence for blockchain verification
   */
  async registerEvidence(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId, filePath } = req.body;

      if (!evidenceId || !filePath) {
        res.status(400).json({
          success: false,
          message: 'Evidence ID and file path are required',
        });
        return;
      }

      const result = await blockchainVerificationService.registerEvidence(
        evidenceId,
        filePath,
        req.user?.id || 'system'
      );

      const response: ApiResponse = {
        success: true,
        message: 'Evidence registered for blockchain verification',
        data: result,
      };

      res.status(201).json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to register evidence',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/evidence/verify
   * Verify evidence integrity
   */
  async verifyEvidence(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId, filePath } = req.body;

      if (!evidenceId || !filePath) {
        res.status(400).json({
          success: false,
          message: 'Evidence ID and file path are required',
        });
        return;
      }

      const result = await blockchainVerificationService.verifyEvidence(
        evidenceId,
        filePath,
        req.user?.id || 'system'
      );

      const response: ApiResponse = {
        success: true,
        message: result.verified ? 'Evidence verified successfully' : 'Evidence verification failed',
        data: result,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to verify evidence',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/evidence/batch-verify
   * Batch verify multiple evidence items
   */
  async batchVerify(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceItems } = req.body;

      if (!evidenceItems || !Array.isArray(evidenceItems) || evidenceItems.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Evidence items array is required',
        });
        return;
      }

      const result = await blockchainVerificationService.batchVerify(
        evidenceItems,
        req.user?.id || 'system'
      );

      const response: ApiResponse = {
        success: true,
        message: `Batch verification completed: ${result.verified} verified, ${result.modified} modified, ${result.failed} failed`,
        data: result,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to batch verify evidence',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/package/create
   * Create evidence package hash
   */
  async createPackage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { investigationId, evidenceIds, filePaths } = req.body;

      if (!investigationId || !evidenceIds || !filePaths) {
        res.status(400).json({
          success: false,
          message: 'Investigation ID, evidence IDs, and file paths are required',
        });
        return;
      }

      const result = await blockchainVerificationService.createPackageHash(
        investigationId,
        evidenceIds,
        filePaths,
        req.user?.id || 'system'
      );

      const response: ApiResponse = {
        success: true,
        message: 'Evidence package hash created',
        data: result,
      };

      res.status(201).json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create evidence package',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/package/verify
   * Verify evidence package
   */
  async verifyPackage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { packageId } = req.body;

      if (!packageId) {
        res.status(400).json({
          success: false,
          message: 'Package ID is required',
        });
        return;
      }

      const result = await blockchainVerificationService.verifyPackage(
        packageId,
        req.user?.id || 'system'
      );

      const response: ApiResponse = {
        success: true,
        message: result.valid ? 'Package verified successfully' : 'Package verification failed',
        data: result,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to verify package',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/audit
   * Get blockchain audit log
   */
  async getAuditLog(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId, eventType, startDate, endDate, limit } = req.query;

      const logs = await blockchainVerificationService.getAuditLog({
        evidenceId: evidenceId as string,
        eventType: eventType as any,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : 100,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Audit log retrieved',
        data: { logs },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get audit log',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/integrity/:investigationId
   * Get integrity records for investigation
   */
  async getInvestigationIntegrity(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { investigationId } = req.params;

      const records = await blockchainVerificationService.getInvestigationIntegrityRecords(
        investigationId
      );

      const response: ApiResponse = {
        success: true,
        message: 'Integrity records retrieved',
        data: { records },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get integrity records',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/alerts
   * Get tamper alerts
   */
  async getTamperAlerts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { unacknowledged } = req.query;

      const alerts = await blockchainVerificationService.getTamperAlerts(
        unacknowledged === 'true'
      );

      const response: ApiResponse = {
        success: true,
        message: 'Tamper alerts retrieved',
        data: { alerts },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get tamper alerts',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/alerts/:alertId/acknowledge
   * Acknowledge tamper alert
   */
  async acknowledgeAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId, alertId } = req.params;
      const { notes } = req.body;

      await blockchainVerificationService.acknowledgeAlert(
        evidenceId,
        alertId,
        req.user?.id || 'system',
        notes
      );

      const response: ApiResponse = {
        success: true,
        message: 'Alert acknowledged',
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to acknowledge alert',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/verification/history/:evidenceId
   * Get verification history for evidence
   */
  async getVerificationHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId } = req.params;

      const history = verificationService.getVerificationHistory(evidenceId);

      const response: ApiResponse = {
        success: true,
        message: 'Verification history retrieved',
        data: { history },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get verification history',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/hash/generate
   * Generate hash for raw data
   */
  async generateHash(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { data } = req.body;

      if (!data) {
        res.status(400).json({
          success: false,
          message: 'Data is required',
        });
        return;
      }

      const { evidenceHashingService } = await import('../index');
      const hash = evidenceHashingService.generateDataFingerprint(
        typeof data === 'string' ? data : JSON.stringify(data)
      );

      const response: ApiResponse = {
        success: true,
        message: 'Hash generated',
        data: { hash, algorithm: 'sha256' },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate hash',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/hash/verify
   * Verify hash matches expected
   */
  async verifyHash(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { filePath, expectedHash } = req.body;

      if (!filePath || !expectedHash) {
        res.status(400).json({
          success: false,
          message: 'File path and expected hash are required',
        });
        return;
      }

      const { evidenceHashingService } = await import('../index');
      const result = await evidenceHashingService.verifyFileIntegrity(filePath, expectedHash);

      const response: ApiResponse = {
        success: true,
        message: result.matches ? 'Hash matches' : 'Hash mismatch detected',
        data: {
          matches: result.matches,
          currentHash: result.currentHash,
          expectedHash,
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to verify hash',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/contract/register
   * Register evidence on smart contract
   */
  async registerOnContract(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId, evidenceHash, investigationId, metadata } = req.body;

      if (!evidenceId || !evidenceHash) {
        res.status(400).json({
          success: false,
          message: 'Evidence ID and evidence hash are required',
        });
        return;
      }

      const { transactionService } = await import('../index');
      const result = await transactionService.registerEvidenceTransaction(
        evidenceId,
        evidenceHash,
        investigationId || '',
        metadata
      );

      const response: ApiResponse = {
        success: result.success,
        message: result.success ? 'Evidence registered on blockchain' : 'Registration failed',
        data: result.transactionRecord,
      };

      res.status(result.success ? 201 : 500).json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to register on contract',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/contract/verify
   * Verify evidence on smart contract
   */
  async verifyOnContract(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId, hashToVerify } = req.body;

      if (!evidenceId || !hashToVerify) {
        res.status(400).json({
          success: false,
          message: 'Evidence ID and hash to verify are required',
        });
        return;
      }

      const { transactionService } = await import('../index');
      const result = await transactionService.verifyEvidenceTransaction(evidenceId, hashToVerify);

      const response: ApiResponse = {
        success: result.success,
        message: result.success ? 'Evidence verified on blockchain' : 'Verification failed',
        data: result.transactionRecord,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to verify on contract',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/contract/evidence/:evidenceId
   * Get evidence info from smart contract
   */
  async getContractEvidence(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId } = req.params;

      const { smartContractService } = await import('../index');
      const evidence = await smartContractService.getEvidence(evidenceId);

      if (!evidence) {
        res.status(404).json({
          success: false,
          message: 'Evidence not found on blockchain',
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Evidence retrieved from blockchain',
        data: { evidence },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get evidence from contract',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/contract/exists/:evidenceId
   * Check if evidence exists on blockchain
   */
  async checkContractEvidence(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId } = req.params;

      const { smartContractService } = await import('../index');
      const exists = await smartContractService.checkEvidenceExists(evidenceId);

      const response: ApiResponse = {
        success: true,
        message: exists ? 'Evidence exists on blockchain' : 'Evidence not found on blockchain',
        data: { exists },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to check evidence',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/transactions
   * Get transaction history
   */
  async getTransactions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { status, type, limit } = req.query;

      const { transactionService } = await import('../index');

      let transactions;
      if (status) {
        transactions = transactionService.getTransactionsByStatus(status as any);
      } else if (type) {
        transactions = transactionService.getTransactionsByType(type as any);
      } else {
        transactions = transactionService.getAllTransactions();
      }

      const limited = limit ? transactions.slice(0, parseInt(limit as string)) : transactions;

      const response: ApiResponse = {
        success: true,
        message: 'Transactions retrieved',
        data: { transactions: limited, total: transactions.length },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get transactions',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/transactions/stats
   * Get transaction statistics
   */
  async getTransactionStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { transactionService } = await import('../index');
      const stats = transactionService.getTransactionStats();

      const response: ApiResponse = {
        success: true,
        message: 'Transaction statistics retrieved',
        data: { stats },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get transaction stats',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/transactions/:txId/retry
   * Retry failed transaction
   */
  async retryTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { txId } = req.params;

      const { transactionService } = await import('../index');
      const result = await transactionService.retryTransaction(txId);

      const response: ApiResponse = {
        success: result.success,
        message: result.success ? 'Transaction retry initiated' : 'Retry failed',
        data: result.transactionRecord,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retry transaction',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/audit/record
   * Record audit entry on blockchain
   */
  async recordAuditEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { category, severity, description, investigationId, evidenceId, metadata } = req.body;

      if (!description) {
        res.status(400).json({
          success: false,
          message: 'Description is required',
        });
        return;
      }

      const { transactionService } = await import('../index');
      const result = await transactionService.recordAuditTransaction({
        category: category || 0,
        severity: severity || 0,
        description,
        investigationId: investigationId || '',
        evidenceId,
        metadata,
      });

      const response: ApiResponse = {
        success: result.success,
        message: result.success ? 'Audit entry recorded on blockchain' : 'Failed to record audit',
        data: result.transactionRecord,
      };

      res.status(result.success ? 201 : 500).json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to record audit entry',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/audit/evidence/:evidenceId
   * Get audit entries for evidence from blockchain
   */
  async getEvidenceAuditFromChain(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId } = req.params;

      const { smartContractService } = await import('../index');
      const auditEntries = await smartContractService.getEvidenceAudit(evidenceId);

      const response: ApiResponse = {
        success: true,
        message: 'Audit entries retrieved from blockchain',
        data: { auditEntries },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get audit entries',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/tamper/record
   * Record tamper detection on blockchain
   */
  async recordTamperDetection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId, investigationId, expectedHash, actualHash } = req.body;

      if (!evidenceId || !expectedHash || !actualHash) {
        res.status(400).json({
          success: false,
          message: 'Evidence ID, expected hash, and actual hash are required',
        });
        return;
      }

      const { smartContractService } = await import('../index');
      const result = await smartContractService.recordTamperDetection(
        evidenceId,
        investigationId || '',
        expectedHash,
        actualHash
      );

      const response: ApiResponse = {
        success: result.success,
        message: result.success ? 'Tamper detection recorded on blockchain' : 'Failed to record',
        data: result,
      };

      res.status(result.success ? 201 : 500).json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to record tamper detection',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/explorer/tx/:txHash
   * Get explorer URL for transaction
   */
  async getExplorerUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { txHash } = req.params;

      const { smartContractService } = await import('../index');
      const explorerUrl = smartContractService.getExplorerUrl(txHash);

      const response: ApiResponse = {
        success: true,
        message: 'Explorer URL generated',
        data: { explorerUrl },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate explorer URL',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ============================================
  // SYNCHRONIZATION ENDPOINTS
  // ============================================

  /**
   * GET /api/v1/blockchain/sync/status
   * Get synchronization status
   */
  async getSyncStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const [state, queueStatus, healthReport] = await Promise.all([
        blockchainSyncService.getSyncState(),
        blockchainSyncService.getQueueStatus(),
        blockchainSyncService.getSyncHealthReport(),
      ]);

      const response: ApiResponse = {
        success: true,
        message: 'Synchronization status retrieved',
        data: { state, queueStatus, healthReport },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get sync status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/sync/queue
   * Queue evidence for blockchain sync
   */
  async queueForSync(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId, fingerprint } = req.body;

      if (!evidenceId || !fingerprint) {
        res.status(400).json({
          success: false,
          message: 'Evidence ID and fingerprint are required',
        });
        return;
      }

      const syncId = await blockchainSyncService.queueEvidenceRegistration(
        evidenceId,
        fingerprint
      );

      const response: ApiResponse = {
        success: true,
        message: 'Evidence queued for synchronization',
        data: { syncId },
      };

      res.status(201).json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to queue for sync',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/sync/process
   * Process synchronization queue
   */
  async processSyncQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await blockchainSyncService.processQueue();

      const response: ApiResponse = {
        success: true,
        message: `Processed ${result.processed} items: ${result.successful} successful, ${result.failed} failed`,
        data: result,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to process sync queue',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/sync/retry
   * Retry failed sync operations
   */
  async retryFailedSync(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const count = await blockchainSyncService.retryFailed();

      const response: ApiResponse = {
        success: true,
        message: `${count} failed operations re-queued for retry`,
        data: { retryCount: count },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retry sync operations',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/sync/consistency/:evidenceId
   * Check evidence-chain consistency
   */
  async checkConsistency(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId } = req.params;

      const result = await blockchainSyncService.validateConsistency(evidenceId);

      const response: ApiResponse = {
        success: true,
        message: result.consistent ? 'Evidence is consistent with blockchain' : 'Inconsistencies detected',
        data: result,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to check consistency',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ============================================
  // VERIFICATION WORKER ENDPOINTS
  // ============================================

  /**
   * GET /api/v1/blockchain/worker/status
   * Get verification worker status
   */
  async getWorkerStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const queueStatus = distributedVerificationService.getQueueStatus();
      const stats = distributedVerificationService.getVerificationStats();
      const schedules = distributedVerificationService.getSchedules();

      const response: ApiResponse = {
        success: true,
        message: 'Worker status retrieved',
        data: { queueStatus, stats, schedules },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get worker status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/worker/job
   * Create verification job
   */
  async createVerificationJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { type, evidenceIds, priority, filePaths } = req.body;

      if (!type || !evidenceIds || !Array.isArray(evidenceIds)) {
        res.status(400).json({
          success: false,
          message: 'Type and evidence IDs array are required',
        });
        return;
      }

      const jobId = await distributedVerificationService.createJob(
        type,
        evidenceIds,
        req.user?.id || 'system',
        priority || 'normal',
        filePaths
      );

      const response: ApiResponse = {
        success: true,
        message: 'Verification job created',
        data: { jobId },
      };

      res.status(201).json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create verification job',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/worker/job/:jobId
   * Get verification job status
   */
  async getJobStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      const job = distributedVerificationService.getJobStatus(jobId);

      if (!job) {
        res.status(404).json({
          success: false,
          message: 'Job not found',
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Job status retrieved',
        data: { job },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get job status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/worker/job/:jobId/cancel
   * Cancel verification job
   */
  async cancelJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      const cancelled = distributedVerificationService.cancelJob(jobId);

      const response: ApiResponse = {
        success: cancelled,
        message: cancelled ? 'Job cancelled' : 'Failed to cancel job (may already be processing)',
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to cancel job',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/worker/schedule
   * Create verification schedule
   */
  async createSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, cronExpression, evidenceFilter } = req.body;

      if (!name || !cronExpression) {
        res.status(400).json({
          success: false,
          message: 'Name and cron expression are required',
        });
        return;
      }

      const scheduleId = await distributedVerificationService.createSchedule(
        name,
        cronExpression,
        evidenceFilter || {},
        req.user?.id || 'system'
      );

      const response: ApiResponse = {
        success: true,
        message: 'Verification schedule created',
        data: { scheduleId },
      };

      res.status(201).json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create schedule',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ============================================
  // RECONCILIATION ENDPOINTS
  // ============================================

  /**
   * POST /api/v1/blockchain/reconciliation/run
   * Run full reconciliation
   */
  async runReconciliation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const report = await blockchainReconciliationService.performFullReconciliation();

      const response: ApiResponse = {
        success: true,
        message: `Reconciliation completed: ${report.issuesFound} issues found, ${report.issuesResolved} resolved`,
        data: { report },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to run reconciliation',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/reconciliation/issues
   * Get active reconciliation issues
   */
  async getReconciliationIssues(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { severity } = req.query;

      let issues;
      if (severity) {
        issues = blockchainReconciliationService.getIssuesBySeverity(severity as any);
      } else {
        issues = blockchainReconciliationService.getActiveIssues();
      }

      const response: ApiResponse = {
        success: true,
        message: 'Reconciliation issues retrieved',
        data: { issues },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get reconciliation issues',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/blockchain/reconciliation/issues/:issueId/resolve
   * Acknowledge and resolve reconciliation issue
   */
  async resolveIssue(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { issueId } = req.params;
      const { resolution } = req.body;

      if (!resolution) {
        res.status(400).json({
          success: false,
          message: 'Resolution description is required',
        });
        return;
      }

      const resolved = await blockchainReconciliationService.acknowledgeIssue(issueId, resolution);

      const response: ApiResponse = {
        success: resolved,
        message: resolved ? 'Issue resolved' : 'Issue not found',
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to resolve issue',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/reconciliation/stats
   * Get reconciliation statistics
   */
  async getReconciliationStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const stats = await blockchainReconciliationService.getReconciliationStats();

      const response: ApiResponse = {
        success: true,
        message: 'Reconciliation statistics retrieved',
        data: { stats },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get reconciliation stats',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/reconciliation/check/:evidenceId
   * Check specific evidence consistency
   */
  async checkEvidenceReconciliation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId } = req.params;

      const result = await blockchainReconciliationService.checkEvidenceConsistency(evidenceId);

      const response: ApiResponse = {
        success: true,
        message: result.consistent ? 'Evidence is consistent' : 'Inconsistencies found',
        data: result,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to check evidence consistency',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ============================================
  // STATE TRACKING ENDPOINTS
  // ============================================

  /**
   * GET /api/v1/blockchain/state
   * Get blockchain state
   */
  async getBlockchainState(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const state = await blockchainStateTrackingService.getCurrentState();
      const snapshot = await blockchainStateTrackingService.takeSnapshot();

      const response: ApiResponse = {
        success: true,
        message: 'Blockchain state retrieved',
        data: { ...state, snapshot },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get blockchain state',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/state/health
   * Get health metrics
   */
  async getHealthMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const health = await blockchainStateTrackingService.calculateHealthMetrics();

      const response: ApiResponse = {
        success: true,
        message: 'Health metrics retrieved',
        data: { health },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get health metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/state/metrics
   * Get performance metrics
   */
  async getPerformanceMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const txMetrics = await blockchainStateTrackingService.getTransactionMetrics();
      const perfMetrics = blockchainStateTrackingService.getPerformanceMetrics();

      const response: ApiResponse = {
        success: true,
        message: 'Performance metrics retrieved',
        data: { transactionMetrics: txMetrics, performanceMetrics: perfMetrics },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get performance metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/blockchain/state/operations
   * Get operation history
   */
  async getOperationHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { operation, status, from, to, limit } = req.query;

      const history = blockchainStateTrackingService.getOperationHistory({
        operation: operation as string,
        status: status as any,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined,
        limit: limit ? parseInt(limit as string) : 100,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Operation history retrieved',
        data: { history },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get operation history',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const blockchainController = new BlockchainController();
export default blockchainController;
