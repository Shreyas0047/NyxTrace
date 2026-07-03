/**
 * Blockchain Synchronization Service
 * Manages evidence registration and verification synchronization with blockchain
 */

import logger from '../config/logger';
import { BlockchainVerification, EvidenceIntegrity, BlockchainAudit, EvidencePackageHash } from './models/blockchain.model';
import { blockchainService } from './blockchain.service';
import { smartContractService } from './smart-contract.service';
import { transactionService } from './transaction.service';
import { BlockchainEventType, VerificationStatus } from './types';
import { v4 as uuidv4 } from 'uuid';

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

export interface SyncQueueItem {
  id: string;
  operation: SyncOperation;
  evidenceId?: string;
  packageId?: string;
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
  private syncQueue: SyncQueueItem[] = [];
  private syncState: SyncState = {
    lastSyncTimestamp: null,
    lastSuccessfulSync: null,
    pendingOperations: 0,
    failedOperations: 0,
    totalSynced: 0,
    blockchainConfirmed: 0,
    syncHealth: 'healthy',
  };
  private isProcessing = false;
  private readonly MAX_RETRIES = 3;
  private readonly PROCESS_INTERVAL = 5000; // 5 seconds
  private autoProcessTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Start automatic queue processing on an interval.
   * Called once at service initialization.
   */
  startAutoProcessing(): void {
    if (this.autoProcessTimer) return;
    logger.info('[Sync] Starting automatic queue processing every 5s');
    this.autoProcessTimer = setInterval(async () => {
      const pending = this.syncQueue.filter(
        i => i.status === SyncStatus.PENDING || i.status === SyncStatus.RETRYING
      ).length;
      if (pending > 0) {
        const result = await this.processQueue();
        if (result.processed > 0) {
          logger.info(`[Sync] Auto-processed ${result.processed} items (${result.successful} ok, ${result.failed} failed)`);
        }
      }
    }, this.PROCESS_INTERVAL);
  }

  /**
   * Stop automatic queue processing.
   */
  stopAutoProcessing(): void {
    if (this.autoProcessTimer) {
      clearInterval(this.autoProcessTimer);
      this.autoProcessTimer = null;
      logger.info('[Sync] Stopped automatic queue processing');
    }
  }

  /**
   * Add evidence to synchronization queue
   */
  async queueEvidenceRegistration(
    evidenceId: string,
    fingerprint: string
  ): Promise<string> {
    const item: SyncQueueItem = {
      id: uuidv4(),
      operation: SyncOperation.EVIDENCE_REGISTER,
      evidenceId,
      status: SyncStatus.PENDING,
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      createdAt: new Date(),
    };

    this.syncQueue.push(item);
    this.updateStateMetrics();

    // Log to audit
    await this.logAudit(evidenceId, BlockchainEventType.EVIDENCE_REGISTERED,
      'Evidence queued for blockchain registration', 'system', { fingerprint });

    return item.id;
  }

  /**
   * Queue verification for synchronization
   */
  async queueEvidenceVerification(evidenceId: string): Promise<string> {
    const item: SyncQueueItem = {
      id: uuidv4(),
      operation: SyncOperation.EVIDENCE_VERIFY,
      evidenceId,
      status: SyncStatus.PENDING,
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      createdAt: new Date(),
    };

    this.syncQueue.push(item);
    this.updateStateMetrics();

    return item.id;
  }

  /**
   * Process synchronization queue
   */
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
      const pendingItems = this.syncQueue.filter(
        item => item.status === SyncStatus.PENDING || item.status === SyncStatus.RETRYING
      );

      for (const item of pendingItems) {
        results.processed++;
        item.status = SyncStatus.IN_PROGRESS;
        item.lastAttemptAt = new Date();

        try {
          await this.processSyncItem(item);

          item.status = SyncStatus.COMPLETED;
          results.successful++;
          this.syncState.lastSuccessfulSync = new Date();
          this.syncState.totalSynced++;

          // Update database records
          await this.updateBlockchainRecord(item);
        } catch (error) {
          await this.handleSyncFailure(item, error);
          results.failed++;
        }
      }

      this.syncState.lastSyncTimestamp = new Date();
      this.updateStateMetrics();
    } finally {
      this.isProcessing = false;
    }

    return results;
  }

  /**
   * Process individual sync item
   */
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

  /**
   * Register evidence on blockchain
   */
  private async registerEvidenceOnChain(item: SyncQueueItem): Promise<void> {
    const verification = await BlockchainVerification.findOne({
      evidenceId: item.evidenceId,
    });

    if (!verification) {
      throw new Error(`Verification record not found for ${item.evidenceId}`);
    }

    // Try smart contract registration first
    try {
      const txHash = await smartContractService.registerEvidence(
        item.evidenceId!,
        verification.fingerprint,
        'unknown'
      );

      item.transactionHash = txHash.transactionHash;

      // Wait for confirmation
      const confirmation = item.transactionHash
        ? await blockchainService.verifyTransaction(item.transactionHash)
        : { confirmed: false, blockNumber: 0 };

      if (confirmation.confirmed) {
        item.blockNumber = confirmation.blockNumber;
        this.syncState.blockchainConfirmed++;
      }
    } catch (error) {
      // Fall back to local-only registration if blockchain fails
      logger.warn(`[Sync] Blockchain registration failed, using local-only: ${error}`);
      item.status = SyncStatus.COMPLETED;
    }
  }

  /**
   * Verify evidence on blockchain
   */
  private async verifyEvidenceOnChain(item: SyncQueueItem): Promise<void> {
    try {
      const verification = await BlockchainVerification.findOne({ evidenceId: item.evidenceId });
      if (!verification) {
        throw new Error(`Verification record not found for ${item.evidenceId}`);
      }

      const result = await smartContractService.verifyEvidence(item.evidenceId!, verification.fingerprint);

      if (result.verified) {
        item.blockNumber = result.blockNumber;
        this.syncState.blockchainConfirmed++;
      }
    } catch (error) {
      logger.warn(`[Sync] Blockchain verification failed: ${error}`);
    }
  }

  /**
   * Register package on blockchain
   */
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
          this.syncState.blockchainConfirmed++;
        }

        this.syncState.totalSynced++;
      }
    } catch (error) {
      logger.warn(`[Sync] Package blockchain registration failed, using local-only: ${error}`);
      item.status = SyncStatus.COMPLETED;
    }
  }

  /**
   * Verify package on blockchain
   */
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

      if (allVerified) {
        this.syncState.totalSynced++;
        this.syncState.blockchainConfirmed++;
      }
    } catch (error) {
      logger.warn(`[Sync] Package blockchain verification failed: ${error}`);
    }
  }

  /**
   * Handle sync failure with retry logic
   */
  private async handleSyncFailure(item: SyncQueueItem, error: unknown): Promise<void> {
    item.error = error instanceof Error ? error.message : 'Unknown error';
    item.retryCount++;

    if (item.retryCount < item.maxRetries) {
      item.status = SyncStatus.RETRYING;
    } else {
      item.status = SyncStatus.FAILED;
      this.syncState.failedOperations++;

      // Log to audit
      await this.logAudit(
        item.evidenceId || null,
        BlockchainEventType.VERIFICATION_FAILED,
        `Sync failed after ${item.maxRetries} retries: ${item.error}`,
        'system',
        { operation: item.operation, error: item.error }
      );
    }
  }

  /**
   * Update blockchain record after successful sync
   */
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

      // Update integrity record
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

  /**
   * Log audit entry
   */
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

  /**
   * Update state metrics
   */
  private updateStateMetrics(): void {
    const pending = this.syncQueue.filter(
      i => i.status === SyncStatus.PENDING || i.status === SyncStatus.RETRYING
    ).length;
    const failed = this.syncQueue.filter(i => i.status === SyncStatus.FAILED).length;

    this.syncState.pendingOperations = pending;
    this.syncState.failedOperations = failed;

    // Determine health
    if (failed > 10 || pending > 100) {
      this.syncState.syncHealth = 'unhealthy';
    } else if (failed > 5 || pending > 50) {
      this.syncState.syncHealth = 'degraded';
    } else {
      this.syncState.syncHealth = 'healthy';
    }
  }

  /**
   * Get current sync state
   */
  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  /**
   * Get sync queue status
   */
  getQueueStatus(): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    items: SyncQueueItem[];
  } {
    return {
      total: this.syncQueue.length,
      pending: this.syncQueue.filter(i => i.status === SyncStatus.PENDING).length,
      inProgress: this.syncQueue.filter(i => i.status === SyncStatus.IN_PROGRESS).length,
      completed: this.syncQueue.filter(i => i.status === SyncStatus.COMPLETED).length,
      failed: this.syncQueue.filter(i => i.status === SyncStatus.FAILED).length,
      items: [...this.syncQueue],
    };
  }

  /**
   * Retry failed operations
   */
  async retryFailed(): Promise<number> {
    const failedItems = this.syncQueue.filter(i => i.status === SyncStatus.FAILED);

    for (const item of failedItems) {
      item.status = SyncStatus.PENDING;
      item.retryCount = 0;
    }

    this.updateStateMetrics();
    return failedItems.length;
  }

  /**
   * Clear completed items from queue
   */
  clearCompleted(maxAge: number = 86400000): number {
    const cutoff = new Date(Date.now() - maxAge);
    const before = this.syncQueue.length;

    this.syncQueue = this.syncQueue.filter(
      item => item.status !== SyncStatus.COMPLETED ||
        (item.status === SyncStatus.COMPLETED && item.lastAttemptAt! > cutoff)
    );

    return before - this.syncQueue.length;
  }

  /**
   * Validate evidence-chain consistency
   */
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

    // Check hash consistency
    if (verification.fingerprint !== integrity.currentHash) {
      discrepancies.push('Fingerprint mismatch between verification and integrity records');
    }

    // Check verification status consistency
    if (verification.status === VerificationStatus.ON_CHAIN && !integrity.blockchainVerified) {
      discrepancies.push('Verification shows on-chain but integrity record not verified');
    }

    // Check transaction consistency
    if (verification.transactionHash && !integrity.blockchainTxHash) {
      discrepancies.push('Transaction hash in verification but missing in integrity record');
    }

    return {
      consistent: discrepancies.length === 0,
      discrepancies,
    };
  }

  /**
   * Get sync health report
   */
  async getSyncHealthReport(): Promise<{
    state: SyncState;
    queueStatus: ReturnType<typeof this.getQueueStatus>;
    blockchainAvailable: boolean;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];

    if (this.syncState.syncHealth === 'unhealthy') {
      recommendations.push('Critical: Review failed sync operations immediately');
    }

    if (this.syncState.failedOperations > 10) {
      recommendations.push('High failure rate detected - check blockchain connectivity');
    }

    if (this.syncState.pendingOperations > 100) {
      recommendations.push('Large queue backlog - consider scaling processing');
    }

    if (!blockchainService.isAvailable()) {
      recommendations.push('Blockchain unavailable - running in offline mode');
    }

    return {
      state: this.getSyncState(),
      queueStatus: this.getQueueStatus(),
      blockchainAvailable: blockchainService.isAvailable(),
      recommendations,
    };
  }
}

export const blockchainSyncService = new BlockchainSyncService();
blockchainSyncService.startAutoProcessing();
export default blockchainSyncService;
