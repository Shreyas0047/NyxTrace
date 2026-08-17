/**
 * Blockchain Service - Main Orchestrator
 * Coordinates all blockchain verification operations
 */

import logger from '../config/logger';
import fs from 'fs';
import {
  VerificationStatus,
  EvidenceIntegrityState,
  BlockchainEventType,
} from './types';
import { blockchainService } from './blockchain.service';
import { evidenceHashingService } from './hashing.service';
import { verificationService } from './verification.service';
import { blockchainSyncService } from './synchronization.service';
import {
  BlockchainVerification,
  EvidenceIntegrity,
  BlockchainAudit,
  EvidencePackageHash,
  BlockchainVerificationStatus,
} from './models/blockchain.model';
import { v4 as uuidv4 } from 'uuid';

export class BlockchainVerificationService {
  /**
   * Initialize blockchain service
   */
  async initialize(): Promise<void> {
    await blockchainService.initialize();
    logger.info('[BlockchainVerification] Service initialized');
  }

  /**
   * Register evidence for blockchain verification
   */
  async registerEvidence(
    evidenceId: string,
    filePathOrUrl: string,
    userId: string,
    sourceType: 'file' | 'url' = 'file'
  ): Promise<{
    fingerprint: string;
    blockchainVerification: any;
    integrityRecord: any;
  }> {
    // Generate evidence fingerprint (file hashing or URL string hashing)
    const fingerprint = sourceType === 'url'
      ? evidenceHashingService.generateDataFingerprint(filePathOrUrl)
      : await evidenceHashingService.generateFileFingerprint(filePathOrUrl);

    // Upsert blockchain verification record (idempotent re-registration)
    const blockchainVerification = await BlockchainVerification.findOneAndUpdate(
      { evidenceId },
      {
        evidenceId,
        fingerprint,
        algorithm: 'sha256',
        status: BlockchainVerificationStatus.PENDING,
        verifiedBy: userId,
      },
      { upsert: true, new: true }
    );

    // Upsert integrity record
    const integrityRecord = await EvidenceIntegrity.findOneAndUpdate(
      { evidenceId },
      {
        evidenceId,
        currentHash: fingerprint,
        integrityState: EvidenceIntegrityState.UNKNOWN,
      },
      { upsert: true, new: true }
    );

    // Queue the fingerprint for on-chain anchoring (sync worker submits the transaction).
    // Re-registration is idempotent: if the evidence is already anchored, skip queueing
    // (the contract reverts on duplicate registration).
    let alreadyAnchored = false;
    if (blockchainService.isAvailable()) {
      try {
        const { smartContractService } = await import('./smart-contract.service');
        alreadyAnchored = await smartContractService.checkEvidenceExists(evidenceId);
      } catch (error) {
        logger.warn(`[BlockchainVerification] Anchor check failed: ${error}`);
      }
      if (!alreadyAnchored) {
        await blockchainSyncService.queueEvidenceRegistration(evidenceId, fingerprint, userId);
      }
    }

    // Add audit entry
    await this.addAuditEntry(
      evidenceId,
      BlockchainEventType.EVIDENCE_REGISTERED,
      `Evidence ${evidenceId} registered for blockchain verification`,
      userId,
      { fingerprint }
    );

    return { fingerprint, blockchainVerification, integrityRecord };
  }

  /**
   * Verify evidence integrity
   */
  async verifyEvidence(
    evidenceId: string,
    filePathOrUrl: string,
    userId: string,
    sourceType: 'file' | 'url' = 'file'
  ): Promise<{
    verified: boolean;
    currentHash: string;
    status: VerificationStatus;
    integrityState: EvidenceIntegrityState;
    verificationRecord: any;
  }> {
    // Get current verification record
    const blockchainVerification = await BlockchainVerification.findOne({ evidenceId });
    if (!blockchainVerification) {
      throw new Error(`No blockchain verification record found for evidence ${evidenceId}`);
    }

    // Perform verification (URL evidence is hashed from the string, files from disk)
    const result = sourceType === 'url'
      ? await verificationService.verifyData(
          evidenceId,
          filePathOrUrl,
          blockchainVerification.fingerprint,
          userId
        )
      : await verificationService.verifyEvidence(
          evidenceId,
          filePathOrUrl,
          blockchainVerification.fingerprint,
          userId
        );

    // Update blockchain verification record
    blockchainVerification.verificationResult = result.status === VerificationStatus.VERIFIED;
    blockchainVerification.verifiedAt = new Date();
    blockchainVerification.verifiedBy = userId as any;
    blockchainVerification.status = result.status as any;
    await blockchainVerification.save();

    // Update or create integrity record
    let integrityRecord = await EvidenceIntegrity.findOne({ evidenceId });
    if (integrityRecord) {
      integrityRecord.currentHash = result.currentHash;
      integrityRecord.integrityState = result.integrityState as any;
      integrityRecord.lastVerifiedAt = new Date();
      integrityRecord.lastVerificationStatus = result.status as any;
      integrityRecord.verificationHistory.push({
        id: uuidv4(),
        timestamp: new Date(),
        hash: result.currentHash,
        status: result.status as any,
        method: 'both',
        verifiedBy: userId,
        details: result.verification.details,
      });

      // Check for tampering
      if (result.status === VerificationStatus.MODIFIED) {
        integrityRecord.tamperAlerts.push({
          id: uuidv4(),
          timestamp: new Date(),
          evidenceId,
          detectedAt: new Date(),
          expectedHash: blockchainVerification.fingerprint,
          actualHash: result.currentHash,
          severity: 'critical',
          acknowledged: false,
        });
      }
      await integrityRecord.save();
    }

    // Add audit entry
    await this.addAuditEntry(
      evidenceId,
      result.status === VerificationStatus.VERIFIED
        ? BlockchainEventType.EVIDENCE_VERIFIED
        : BlockchainEventType.HASH_MISMATCH,
      result.status === VerificationStatus.VERIFIED
        ? `Evidence ${evidenceId} verified successfully`
        : `Hash mismatch detected for evidence ${evidenceId}`,
      userId,
      { currentHash: result.currentHash, status: result.status }
    );

    return {
      verified: result.status === VerificationStatus.VERIFIED,
      currentHash: result.currentHash,
      status: result.status,
      integrityState: result.integrityState,
      verificationRecord: result.verification,
    };
  }

  /**
   * Verify multiple evidence items (batch)
   */
  async batchVerify(
    evidenceItems: Array<{ evidenceId: string; filePath: string }>,
    userId: string
  ): Promise<{
    total: number;
    verified: number;
    modified: number;
    failed: number;
    results: any[];
  }> {
    const results = [];

    for (const item of evidenceItems) {
      try {
        const result = await this.verifyEvidence(item.evidenceId, item.filePath, userId);
        results.push({
          evidenceId: item.evidenceId,
          status: result.status,
          verified: result.verified,
          error: null,
        });
      } catch (error) {
        results.push({
          evidenceId: item.evidenceId,
          status: VerificationStatus.FAILED,
          verified: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      total: evidenceItems.length,
      verified: results.filter((r) => r.verified).length,
      modified: results.filter((r) => r.status === VerificationStatus.MODIFIED).length,
      failed: results.filter((r) => !r.verified && r.status === VerificationStatus.FAILED).length,
      results,
    };
  }

  /**
   * Create evidence package hash
   */
  async createPackageHash(
    investigationId: string,
    evidenceIds: string[],
    filePaths: string[],
    userId: string
  ): Promise<any> {
    // Generate package hash
    const packageHash = await evidenceHashingService.generatePackageHash(
      uuidv4(),
      filePaths,
      userId
    );

    // Create package hash record
    const evidenceHashes = await Promise.all(
      evidenceIds.map(async (id, index) => {
        const hash = await evidenceHashingService.generateFileFingerprint(filePaths[index]);
        return { evidenceId: id, hash, fileName: filePaths[index] };
      })
    );

    const packageRecord = await EvidencePackageHash.create({
      packageId: packageHash.packageId,
      investigationId,
      rootHash: packageHash.rootHash,
      evidenceHashes,
      manifestHash: packageHash.manifestHash,
      evidenceCount: evidenceIds.length,
      createdBy: userId,
    });

    // Add audit entry
    await this.addAuditEntry(
      null,
      BlockchainEventType.EVIDENCE_REGISTERED,
      `Evidence package ${packageHash.packageId} created with ${evidenceIds.length} items`,
      userId,
      { rootHash: packageHash.rootHash }
    );

    return packageRecord;
  }

  /**
   * Verify evidence package
   */
  async verifyPackage(packageId: string, userId: string): Promise<{
    valid: boolean;
    verifiedCount: number;
    failedCount: number;
    results: any[];
  }> {
    const packageRecord = await EvidencePackageHash.findOne({ packageId });
    if (!packageRecord) {
      throw new Error(`Package ${packageId} not found`);
    }

    const results = [];
    let verifiedCount = 0;
    let failedCount = 0;

    for (const item of packageRecord.evidenceHashes) {
      try {
        const verification = await BlockchainVerification.findOne({ evidenceId: item.evidenceId });
        if (verification && verification.fingerprint === item.hash) {
          verifiedCount++;
          results.push({ evidenceId: item.evidenceId, valid: true });
        } else {
          failedCount++;
          results.push({ evidenceId: item.evidenceId, valid: false });
        }
      } catch {
        failedCount++;
        results.push({ evidenceId: item.evidenceId, valid: false });
      }
    }

    // Update package verification
    packageRecord.verificationCount++;
    packageRecord.lastVerifiedAt = new Date();
    packageRecord.lastVerificationStatus = failedCount === 0
      ? BlockchainVerificationStatus.VERIFIED
      : BlockchainVerificationStatus.FAILED;
    await packageRecord.save();

    return {
      valid: failedCount === 0,
      verifiedCount,
      failedCount,
      results,
    };
  }

  /**
   * Get blockchain audit log
   */
  async getAuditLog(
    filters?: {
      evidenceId?: string;
      eventType?: BlockchainEventType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<any[]> {
    const query: any = {};

    if (filters?.evidenceId) {
      query.evidenceId = filters.evidenceId;
    }
    if (filters?.eventType) {
      query.eventType = filters.eventType;
    }
    if (filters?.startDate || filters?.endDate) {
      query.timestamp = {};
      if (filters?.startDate) query.timestamp.$gte = filters.startDate;
      if (filters?.endDate) query.timestamp.$lte = filters.endDate;
    }

    const logs = await BlockchainAudit.find(query)
      .sort({ timestamp: -1 })
      .limit(filters?.limit || 100)
      .lean();

    return logs;
  }

  /**
   * Get integrity records for investigation
   */
  async getInvestigationIntegrityRecords(investigationId: string): Promise<any[]> {
    const { Evidence } = await import('../models');

    const evidenceItems = await Evidence.find({ investigationId }).lean();
    const evidenceIds = evidenceItems.map((e) => e._id);

    const integrityRecords = await EvidenceIntegrity.find({
      evidenceId: { $in: evidenceIds },
    }).lean();

    return integrityRecords;
  }

  /**
   * Get tamper alerts
   */
  async getTamperAlerts(unacknowledgedOnly: boolean = false): Promise<any[]> {
    const query = unacknowledgedOnly ? { acknowledged: false } : {};
    return await EvidenceIntegrity.find({ tamperAlerts: { $exists: true, $ne: [] } })
      .lean();
  }

  /**
   * Acknowledge tamper alert
   */
  async acknowledgeAlert(
    evidenceId: string,
    alertId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    const record = await EvidenceIntegrity.findOne({ evidenceId });
    if (!record) {
      throw new Error(`Integrity record not found for evidence ${evidenceId}`);
    }

    const alert = record.tamperAlerts.find((a: any) => a.id === alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();
    alert.notes = notes;
    await record.save();
  }

  /**
   * Add audit entry
   */
  private async addAuditEntry(
    evidenceId: string | null,
    eventType: BlockchainEventType,
    details: string,
    performedBy: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await BlockchainAudit.create({
      evidenceId,
      eventType,
      details,
      performedBy,
      metadata,
    });
  }

  /**
   * Get blockchain status
   */
  async getBlockchainStatus(): Promise<{
    available: boolean;
    networkName: string;
    chainId: number;
    blockNumber: number;
    verificationMode: string;
  }> {
    const networkInfo = await blockchainService.getNetworkInfo();
    return {
      available: networkInfo.available,
      networkName: networkInfo.networkName,
      chainId: networkInfo.chainId,
      blockNumber: networkInfo.blockNumber,
      verificationMode: networkInfo.available ? 'on-chain' : 'local-only',
    };
  }

  /**
   * Get verification statistics
   */
  async getVerificationStats(): Promise<{
    totalEvidence: number;
    verified: number;
    modified: number;
    pending: number;
    blockchainOnChain: number;
    tamperAlerts: number;
  }> {
    const [total, verified, modified, pending, onChain, integrityRecords] = await Promise.all([
      BlockchainVerification.countDocuments(),
      BlockchainVerification.countDocuments({ status: BlockchainVerificationStatus.VERIFIED }),
      EvidenceIntegrity.countDocuments({ integrityState: EvidenceIntegrityState.MODIFIED }),
      BlockchainVerification.countDocuments({ status: BlockchainVerificationStatus.PENDING }),
      BlockchainVerification.countDocuments({ status: BlockchainVerificationStatus.ON_CHAIN }),
      EvidenceIntegrity.find({ tamperAlerts: { $exists: true, $ne: [] } }).lean(),
    ]);

    const tamperAlertCount = integrityRecords.reduce(
      (count, record) => count + record.tamperAlerts.filter((a) => !a.acknowledged).length,
      0
    );

    return {
      totalEvidence: total,
      verified,
      modified,
      pending,
      blockchainOnChain: onChain,
      tamperAlerts: tamperAlertCount,
    };
  }
}

export const blockchainVerificationService = new BlockchainVerificationService();
export default blockchainVerificationService;
