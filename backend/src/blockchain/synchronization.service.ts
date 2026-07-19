import logger from '../config/logger';
import {
  BlockchainVerification,
  EvidenceIntegrity,
  BlockchainAudit,
  EvidencePackageHash,
  BlockchainSyncQueue,
} from './models/blockchain.model';
import { blockchainService } from './blockchain.service';
import { smartContractService } from './smart-contract.service';
import { transactionService } from './transaction.service';
import { BlockchainEventType, VerificationStatus, SyncStatus, SyncOperation } from './types';

export interface SyncQueueItem {
  id: string;
  operation: SyncOperation;
  evidenceId?: string;
  packageId?: string;
  fingerprint?: string;
  status: SyncStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  lastAttemptAt?: Date;
  error?: string;
  transactionHash?: string;
  blockNumber?: number;
}

export interface SyncState {
  lastSyncTimestamp: Date | null;
  lastSuccessfulSync: Date | null;
  pendingOperations: number;
  failedOperations: number;
  totalSynced: number;
  blockchainConfirmed: number;
  syncHealth: 'healthy' | 'degraded' | 'unhealthy';
}

export class BlockchainSyncService {
  private isProcessing = false;
  private readonly MAX_RETRIES = 3;
  private readonly PROCESS_INTERVAL = 5000;
  private autoProcessTimer: ReturnType<typeof setInterval> | null = null;

  async init(): Promise<void> {
    await this.recoverOrphanedItems();
    this.startAutoProcessing();
  }

  private async recoverOrphanedItems(): Promise<void> {
    try {
      const result = await BlockchainSyncQueue.updateMany(
        { status: SyncStatus.IN_PROGRESS },
        { $set: { status: SyncStatus.PENDING } }
      );
      if (result.modifiedCount > 0) {
        logger.info(`[Sync] Recovery: reset ${result.modifiedCount} in-progress items back to pending`);
      }
    } catch (error) {
      logger.error('[Sync] Recovery failed:', error);
    }
  }

  startAutoProcessing(): void {
    if (this.autoProcessTimer) return;
    logger.info('[Sync] Starting automatic queue processing every 5s');
    this.autoProcessTimer = setInterval(async () => {
      try {
        const pending = await BlockchainSyncQueue.countDocuments({
          status: { $in: [SyncStatus.PENDING, SyncStatus.RETRYING] },
        });
        if (pending > 0) {
          const result = await this.processQueue();
          if (result.processed > 0) {
            logger.info(`[Sync] Auto-processed ${result.processed} items (${result.successful} ok, ${result.failed} failed)`);
          }
        }
      } catch (error) {
        logger.error('[Sync] Auto-processing error:', error);
      }
    }, this.PROCESS_INTERVAL);
  }

  stopAutoProcessing(): void {
    if (this.autoProcessTimer) {
      clearInterval(this.autoProcessTimer);
      this.autoProcessTimer = null;
      logger.info('[Sync] Stopped automatic queue processing');
    }
  }

  async queueEvidenceRegistration(
    evidenceId: string,
    fingerprint: string
  ): Promise<string> {
    const doc = await BlockchainSyncQueue.create({
      operation: SyncOperation.EVIDENCE_REGISTER,
      evidenceId,
      fingerprint,
      status: SyncStatus.PENDING,
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      createdAt: new Date(),
    });

    await this.logAudit(evidenceId, BlockchainEventType.EVIDENCE_REGISTERED,
      'Evidence queued for blockchain registration', 'system', { fingerprint });

    return doc._id.toString();
  }

  async queueEvidenceVerification(evidenceId: string): Promise<string> {
    const doc = await BlockchainSyncQueue.create({
      operation: SyncOperation.EVIDENCE_VERIFY,
      evidenceId,
      status: SyncStatus.PENDING,
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      createdAt: new Date(),
    });

    return doc._id.toString();
  }

  async processQueue(): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    if (this.isProcessing) {
      return { processed: 0, successful: 0, failed: 0 };
    }

    this.isProcessing = true;
    const results = { processed: 0, successful: 0, failed: 0 };

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const doc = await BlockchainSyncQueue.findOneAndUpdate(
          { status: { $in: [SyncStatus.PENDING, SyncStatus.RETRYING] } },
          { $set: { status: SyncStatus.IN_PROGRESS, lastAttemptAt: new Date() } },
          { sort: { createdAt: 1 }, returnDocument: 'after' }
        );
        if (!doc) break;

        results.processed++;
        const item: SyncQueueItem = {
          ...doc.toObject(),
          id: doc._id.toString(),
        } as unknown as SyncQueueItem;

        try {
          await this.processSyncItem(item);
          const updates: Record<string, any> = { status: SyncStatus.COMPLETED };
          if (item.transactionHash) updates.transactionHash = item.transactionHash;
          if (item.blockNumber) updates.blockNumber = item.blockNumber;
          await BlockchainSyncQueue.updateOne({ _id: doc._id }, { $set: updates });
          results.successful++;
          await this.updateBlockchainRecord(item);
        } catch (error) {
          await this.handleSyncFailure(doc._id.toString(), error);
          results.failed++;
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return results;
  }

  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    if (!blockchainService.isAvailable()) {
      throw new Error('Blockchain not available');
    }

    switch (item.operation) {
      case SyncOperation.EVIDENCE_REGISTER:
        await this.registerEvidenceOnChain(item);
        break;
      case SyncOperation.EVIDENCE_VERIFY:
        await this.verifyEvidenceOnChain(item);
        break;
      case SyncOperation.PACKAGE_CREATE:
        await this.registerPackageOnChain(item);
        break;
      case SyncOperation.PACKAGE_VERIFY:
        await this.verifyPackageOnChain(item);
        break;
    }
  }

  private async registerEvidenceOnChain(item: SyncQueueItem): Promise<void> {
    const verification = await BlockchainVerification.findOne({
      evidenceId: item.evidenceId,
    });

    if (!verification) {
      throw new Error(`Verification record not found for ${item.evidenceId}`);
    }

    try {
      const txHash = await smartContractService.registerEvidence(
        item.evidenceId!,
        verification.fingerprint,
        'unknown'
      );

      item.transactionHash = txHash.transactionHash;

      const confirmation = item.transactionHash
        ? await blockchainService.verifyTransaction(item.transactionHash)
        : { confirmed: false, blockNumber: 0 };

      if (confirmation.confirmed) {
        item.blockNumber = confirmation.blockNumber;
      }
    } catch (error) {
      logger.warn(`[Sync] Blockchain registration failed, using local-only: ${error}`);
      item.status = SyncStatus.COMPLETED;
    }
  }

  private async verifyEvidenceOnChain(item: SyncQueueItem): Promise<void> {
    try {
      const verification = await BlockchainVerification.findOne({ evidenceId: item.evidenceId });
      if (!verification) {
        throw new Error(`Verification record not found for ${item.evidenceId}`);
      }

      const result = await smartContractService.verifyEvidence(item.evidenceId!, verification.fingerprint);

      if (result.verified) {
        item.blockNumber = result.blockNumber;
      }
    } catch (error) {
      logger.warn(`[Sync] Blockchain verification failed: ${error}`);
    }
  }

  private async registerPackageOnChain(item: SyncQueueItem): Promise<void> {
    const pkg = await EvidencePackageHash.findOne({ packageId: item.packageId });
    if (!pkg) {
      throw new Error(`Package not found: ${item.packageId}`);
    }

    try {
      const evidenceItems = pkg.evidenceHashes.map((eh: any) => ({
        evidenceId: eh.evidenceId,
        evidenceHash: eh.hash,
      }));

      if (evidenceItems.length === 0) {
        await EvidencePackageHash.updateOne(
          { packageId: item.packageId },
          { $set: { blockchainRegistered: true } }
        );
        item.status = SyncStatus.COMPLETED;
        return;
      }

      const result = await smartContractService.batchRegisterEvidence(
        evidenceItems,
        pkg.investigationId?.toString() || 'unknown'
      );

      if (result.success) {
        item.transactionHash = result.transactionHash;

        const confirmation = result.transactionHash
          ? await blockchainService.verifyTransaction(result.transactionHash)
          : { confirmed: false, blockNumber: 0 };

        await EvidencePackageHash.updateOne(
          { packageId: item.packageId },
          {
            $set: {
              blockchainRegistered: true,
              transactionHash: result.transactionHash,
              blockNumber: confirmation.confirmed ? confirmation.blockNumber : undefined,
            },
          }
        );

        if (confirmation.confirmed) {
          item.blockNumber = confirmation.blockNumber;
        }
      }
    } catch (error) {
      logger.warn(`[Sync] Package blockchain registration failed, using local-only: ${error}`);
      item.status = SyncStatus.COMPLETED;
    }
  }

  private async verifyPackageOnChain(item: SyncQueueItem): Promise<void> {
    const pkg = await EvidencePackageHash.findOne({ packageId: item.packageId });
    if (!pkg) {
      throw new Error(`Package not found: ${item.packageId}`);
    }

    try {
      let allVerified = true;

      for (const eh of pkg.evidenceHashes || []) {
        const exists = await smartContractService.checkEvidenceExists(eh.evidenceId);
        if (!exists) {
          allVerified = false;
          continue;
        }

        const chainHash = await smartContractService.getEvidenceHash(eh.evidenceId);
        if (chainHash) {
          const normalizedChain = chainHash.replace(/^0x/, '').toLowerCase();
          const normalizedDb = eh.hash.replace(/^0x/, '').toLowerCase();
          if (normalizedChain !== normalizedDb) {
            allVerified = false;
          }
        }
      }

      await EvidencePackageHash.updateOne(
        { packageId: item.packageId },
        {
          $set: {
            lastVerifiedAt: new Date(),
            lastVerificationStatus: allVerified ? 'verified' : 'modified',
            verificationCount: (pkg.verificationCount || 0) + 1,
          },
        }
      );
    } catch (error) {
      logger.warn(`[Sync] Package blockchain verification failed: ${error}`);
    }
  }

  private async handleSyncFailure(id: string, error: unknown): Promise<void> {
    const doc = await BlockchainSyncQueue.findById(id);
    if (!doc) return;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const newRetryCount = (doc.retryCount || 0) + 1;

    if (newRetryCount < (doc.maxRetries || 3)) {
      await BlockchainSyncQueue.updateOne(
        { _id: doc._id },
        { $set: { status: SyncStatus.RETRYING, retryCount: newRetryCount, error: errorMessage } }
      );
    } else {
      await BlockchainSyncQueue.updateOne(
        { _id: doc._id },
        { $set: { status: SyncStatus.FAILED, retryCount: newRetryCount, error: errorMessage } }
      );

      await this.logAudit(
        doc.evidenceId || null,
        BlockchainEventType.VERIFICATION_FAILED,
        `Sync failed after ${doc.maxRetries || 3} retries: ${errorMessage}`,
        'system',
        { operation: doc.operation, error: errorMessage }
      );
    }
  }

  private async updateBlockchainRecord(item: SyncQueueItem): Promise<void> {
    if (item.evidenceId) {
      await BlockchainVerification.updateOne(
        { evidenceId: item.evidenceId },
        {
          $set: {
            status: item.status === SyncStatus.COMPLETED
              ? VerificationStatus.ON_CHAIN
              : VerificationStatus.SYNCING,
            transactionHash: item.transactionHash,
            blockNumber: item.blockNumber,
          },
        }
      );

      await EvidenceIntegrity.updateOne(
        { evidenceId: item.evidenceId },
        {
          $set: {
            blockchainVerified: item.status === SyncStatus.COMPLETED,
            blockchainTxHash: item.transactionHash,
            blockchainBlockNumber: item.blockNumber,
          },
        }
      );
    }
  }

  private async logAudit(
    evidenceId: string | null,
    eventType: BlockchainEventType,
    details: string,
    performedBy: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await BlockchainAudit.create({
        evidenceId,
        eventType,
        details,
        performedBy,
        metadata,
      });
    } catch (error) {
      logger.error('[Sync] Failed to log audit:', error);
    }
  }

  private computeHealth(pending: number, failed: number): 'healthy' | 'degraded' | 'unhealthy' {
    if (failed > 10 || pending > 100) return 'unhealthy';
    if (failed > 5 || pending > 50) return 'degraded';
    return 'healthy';
  }

  async getSyncState(): Promise<SyncState> {
    try {
      const [stats] = await BlockchainSyncQueue.aggregate([
        {
          $group: {
            _id: null,
            totalSynced: { $sum: { $cond: [{ $eq: ['$status', SyncStatus.COMPLETED] }, 1, 0] } },
            blockchainConfirmed: {
              $sum: {
                $cond: [
                  { $and: [
                    { $eq: ['$status', SyncStatus.COMPLETED] },
                    { $ne: ['$blockNumber', null] },
                  ]},
                  1,
                  0,
                ],
              },
            },
            pendingOperations: {
              $sum: {
                $cond: [
                  { $in: ['$status', [SyncStatus.PENDING, SyncStatus.RETRYING]] },
                  1,
                  0,
                ],
              },
            },
            failedOperations: { $sum: { $cond: [{ $eq: ['$status', SyncStatus.FAILED] }, 1, 0] } },
            lastSyncTimestamp: { $max: '$lastAttemptAt' },
            lastSuccessfulSync: {
              $max: {
                $cond: [{ $eq: ['$status', SyncStatus.COMPLETED] }, '$lastAttemptAt', null],
              },
            },
          },
        },
      ]);

      const pending = stats?.pendingOperations || 0;
      const failed = stats?.failedOperations || 0;

      return {
        lastSyncTimestamp: stats?.lastSyncTimestamp || null,
        lastSuccessfulSync: stats?.lastSuccessfulSync || null,
        totalSynced: stats?.totalSynced || 0,
        blockchainConfirmed: stats?.blockchainConfirmed || 0,
        pendingOperations: pending,
        failedOperations: failed,
        syncHealth: this.computeHealth(pending, failed),
      };
    } catch (error) {
      logger.error('[Sync] Failed to get sync state:', error);
      return {
        lastSyncTimestamp: null,
        lastSuccessfulSync: null,
        pendingOperations: 0,
        failedOperations: 0,
        totalSynced: 0,
        blockchainConfirmed: 0,
        syncHealth: 'unhealthy',
      };
    }
  }

  async getQueueStatus(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    items: SyncQueueItem[];
  }> {
    try {
      const [counts] = await BlockchainSyncQueue.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', SyncStatus.PENDING] }, 1, 0] } },
            inProgress: { $sum: { $cond: [{ $eq: ['$status', SyncStatus.IN_PROGRESS] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ['$status', SyncStatus.COMPLETED] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', SyncStatus.FAILED] }, 1, 0] } },
          },
        },
      ]);

      const items = await BlockchainSyncQueue.find()
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      return {
        total: counts?.total || 0,
        pending: counts?.pending || 0,
        inProgress: counts?.inProgress || 0,
        completed: counts?.completed || 0,
        failed: counts?.failed || 0,
        items: items.map((i: any) => ({
          ...i,
          id: i._id.toString(),
        })) as unknown as SyncQueueItem[],
      };
    } catch (error) {
      logger.error('[Sync] Failed to get queue status:', error);
      return {
        total: 0, pending: 0, inProgress: 0, completed: 0, failed: 0, items: [],
      };
    }
  }

  async retryFailed(): Promise<number> {
    const result = await BlockchainSyncQueue.updateMany(
      { status: SyncStatus.FAILED },
      { $set: { status: SyncStatus.PENDING, retryCount: 0, error: null } }
    );
    return result.modifiedCount;
  }

  async clearCompleted(maxAge: number = 86400000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAge);
    const result = await BlockchainSyncQueue.deleteMany({
      status: SyncStatus.COMPLETED,
      lastAttemptAt: { $lt: cutoff },
    });
    return result.deletedCount;
  }

  async validateConsistency(evidenceId: string): Promise<{
    consistent: boolean;
    discrepancies: string[];
  }> {
    const discrepancies: string[] = [];

    const verification = await BlockchainVerification.findOne({ evidenceId });
    const integrity = await EvidenceIntegrity.findOne({ evidenceId });

    if (!verification || !integrity) {
      return { consistent: false, discrepancies: ['Missing records'] };
    }

    if (verification.fingerprint !== integrity.currentHash) {
      discrepancies.push('Fingerprint mismatch between verification and integrity records');
    }

    if (verification.status === VerificationStatus.ON_CHAIN && !integrity.blockchainVerified) {
      discrepancies.push('Verification shows on-chain but integrity record not verified');
    }

    if (verification.transactionHash && !integrity.blockchainTxHash) {
      discrepancies.push('Transaction hash in verification but missing in integrity record');
    }

    return {
      consistent: discrepancies.length === 0,
      discrepancies,
    };
  }

  async getSyncHealthReport(): Promise<{
    state: SyncState;
    queueStatus: Awaited<ReturnType<typeof this.getQueueStatus>>;
    blockchainAvailable: boolean;
    recommendations: string[];
  }> {
    const [state, queueStatus] = await Promise.all([
      this.getSyncState(),
      this.getQueueStatus(),
    ]);

    const recommendations: string[] = [];

    if (state.syncHealth === 'unhealthy') {
      recommendations.push('Critical: Review failed sync operations immediately');
    }

    if (state.failedOperations > 10) {
      recommendations.push('High failure rate detected - check blockchain connectivity');
    }

    if (state.pendingOperations > 100) {
      recommendations.push('Large queue backlog - consider scaling processing');
    }

    if (!blockchainService.isAvailable()) {
      recommendations.push('Blockchain unavailable - running in offline mode');
    }

    return {
      state,
      queueStatus,
      blockchainAvailable: blockchainService.isAvailable(),
      recommendations,
    };
  }
}

export const blockchainSyncService = new BlockchainSyncService();
export default blockchainSyncService;
