/**
 * Verification Service - Evidence Integrity Verification
 * Main service for verification workflows and tamper detection
 */

import fs from 'fs';
import {
  VerificationStatus,
  EvidenceIntegrityState,
  VerificationRecord,
  BlockchainVerification,
  EvidenceIntegrityRecord,
  TamperAlert,
  BlockchainAuditEntry,
  BlockchainEventType,
} from './types';
import { evidenceHashingService } from './hashing.service';
import { blockchainService } from './blockchain.service';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

export class VerificationService {
  private verificationHistory: Map<string, VerificationRecord[]> = new Map();
  private tamperAlerts: Map<string, TamperAlert[]> = new Map();
  private auditLog: BlockchainAuditEntry[] = [];

  /**
   * Verify evidence integrity
   */
  async verifyEvidence(
    evidenceId: string,
    filePath: string,
    expectedHash: string,
    verifiedBy: string
  ): Promise<{
    status: VerificationStatus;
    currentHash: string;
    integrityState: EvidenceIntegrityState;
    verification: VerificationRecord;
  }> {
    // Verify file against expected hash
    const result = await evidenceHashingService.verifyFileIntegrity(filePath, expectedHash);

    // Determine status
    let status: VerificationStatus;
    let integrityState: EvidenceIntegrityState;

    if (!result.valid) {
      status = VerificationStatus.FAILED;
      integrityState = EvidenceIntegrityState.VERIFICATION_FAILED;
    } else if (result.matches) {
      status = VerificationStatus.VERIFIED;
      integrityState = EvidenceIntegrityState.INTACT;
    } else {
      status = VerificationStatus.MODIFIED;
      integrityState = EvidenceIntegrityState.MODIFIED;

      // Create tamper alert
      await this.createTamperAlert(evidenceId, expectedHash, result.currentHash);
    }

    // Create verification record
    const verification = evidenceHashingService.createVerificationRecord(
      evidenceId,
      result.currentHash,
      status,
      'local',
      verifiedBy,
      result.matches ? 'Integrity verified successfully' : 'Integrity mismatch detected'
    );

    // Store verification in history
    this.addVerificationToHistory(evidenceId, verification);

    // Add to audit log
    this.addAuditEntry({
      eventType: result.matches ? BlockchainEventType.EVIDENCE_VERIFIED : BlockchainEventType.HASH_MISMATCH,
      evidenceId,
      details: result.matches
        ? `Evidence ${evidenceId} verified successfully`
        : `Hash mismatch detected for evidence ${evidenceId}`,
      performedBy: verifiedBy,
    });

    return {
      status,
      currentHash: result.currentHash,
      integrityState,
      verification,
    };
  }

  /**
   * Verify raw data (e.g. a URL string) against an expected SHA-256 hash.
   * Mirrors verifyEvidence for evidence kinds that have no artifact on disk.
   */
  async verifyData(
    evidenceId: string,
    data: string,
    expectedHash: string,
    verifiedBy: string
  ): Promise<{
    status: VerificationStatus;
    currentHash: string;
    integrityState: EvidenceIntegrityState;
    verification: VerificationRecord;
  }> {
    const result = evidenceHashingService.verifyHash(data, expectedHash);

    let status: VerificationStatus;
    let integrityState: EvidenceIntegrityState;

    if (result.matches) {
      status = VerificationStatus.VERIFIED;
      integrityState = EvidenceIntegrityState.INTACT;
    } else {
      status = VerificationStatus.MODIFIED;
      integrityState = EvidenceIntegrityState.MODIFIED;
      await this.createTamperAlert(evidenceId, expectedHash, result.hash);
    }

    const verification = evidenceHashingService.createVerificationRecord(
      evidenceId,
      result.hash,
      status,
      'local',
      verifiedBy,
      result.matches ? 'Integrity verified successfully' : 'Integrity mismatch detected'
    );

    this.addVerificationToHistory(evidenceId, verification);
    this.addAuditEntry({
      eventType: result.matches ? BlockchainEventType.EVIDENCE_VERIFIED : BlockchainEventType.HASH_MISMATCH,
      evidenceId,
      details: result.matches
        ? `Evidence ${evidenceId} verified successfully`
        : `Hash mismatch detected for evidence ${evidenceId}`,
      performedBy: verifiedBy,
    });

    return {
      status,
      currentHash: result.hash,
      integrityState,
      verification,
    };
  }

  /**
   * Verify evidence with blockchain preparation
   */
  async verifyEvidenceWithBlockchain(
    evidenceId: string,
    filePath: string,
    expectedHash: string,
    verifiedBy: string
  ): Promise<{
    status: VerificationStatus;
    currentHash: string;
    integrityState: EvidenceIntegrityState;
    verification: VerificationRecord;
    blockchainReady: boolean;
    transactionHash?: string;
    blockNumber?: number;
  }> {
    // Perform local verification first
    const localResult = await this.verifyEvidence(evidenceId, filePath, expectedHash, verifiedBy);

    // If verified locally and blockchain is available, prepare for chain storage
    let blockchainReady = false;
    let transactionHash: string | undefined;
    let blockNumber: number | undefined;

    if (localResult.status === VerificationStatus.VERIFIED && blockchainService.isAvailable()) {
      blockchainReady = true;

      // In a production system, this would submit to smart contract
      // For now, we prepare the verification for potential chain submission
      this.addAuditEntry({
        eventType: BlockchainEventType.EVIDENCE_REGISTERED,
        evidenceId,
        details: `Verification prepared for blockchain submission`,
        performedBy: verifiedBy,
        metadata: {
          hash: localResult.currentHash,
          method: 'both',
        },
      });
    }

    return {
      ...localResult,
      blockchainReady,
      transactionHash,
      blockNumber,
    };
  }

  /**
   * Create tamper alert
   */
  async createTamperAlert(
    evidenceId: string,
    expectedHash: string,
    actualHash: string
  ): Promise<TamperAlert> {
    const alert: TamperAlert = {
      id: uuidv4(),
      timestamp: new Date(),
      evidenceId,
      detectedAt: new Date(),
      expectedHash,
      actualHash,
      severity: 'critical',
      acknowledged: false,
    };

    const alerts = this.tamperAlerts.get(evidenceId) || [];
    alerts.push(alert);
    this.tamperAlerts.set(evidenceId, alerts);

    // Add to audit log
    this.addAuditEntry({
      eventType: BlockchainEventType.TAMPER_DETECTED,
      evidenceId,
      details: `Tampering detected for evidence ${evidenceId}`,
      performedBy: 'system',
      metadata: {
        expectedHash,
        actualHash,
        severity: 'critical',
      },
    });

    return alert;
  }

  /**
   * Acknowledge tamper alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string, notes?: string): void {
    for (const [evidenceId, alerts] of this.tamperAlerts.entries()) {
      const alert = alerts.find((a) => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        alert.acknowledgedBy = acknowledgedBy;
        alert.acknowledgedAt = new Date();
        alert.notes = notes;
        break;
      }
    }
  }

  /**
   * Get tamper alerts for evidence
   */
  getTamperAlerts(evidenceId?: string): TamperAlert[] {
    if (evidenceId) {
      return this.tamperAlerts.get(evidenceId) || [];
    }

    const allAlerts: TamperAlert[] = [];
    for (const alerts of this.tamperAlerts.values()) {
      allAlerts.push(...alerts);
    }
    return allAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): TamperAlert[] {
    return this.getTamperAlerts().filter((a) => !a.acknowledged);
  }

  /**
   * Add verification to history
   */
  private addVerificationToHistory(evidenceId: string, verification: VerificationRecord): void {
    const history = this.verificationHistory.get(evidenceId) || [];
    history.push(verification);
    this.verificationHistory.set(evidenceId, history);
  }

  /**
   * Get verification history
   */
  getVerificationHistory(evidenceId: string): VerificationRecord[] {
    return this.verificationHistory.get(evidenceId) || [];
  }

  /**
   * Add audit entry
   */
  private addAuditEntry(entry: Omit<BlockchainAuditEntry, 'id' | 'timestamp'>): void {
    const auditEntry: BlockchainAuditEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      ...entry,
    };
    this.auditLog.push(auditEntry);

    // Keep audit log size manageable
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(filters?: {
    evidenceId?: string;
    eventType?: BlockchainEventType;
    startDate?: Date;
    endDate?: Date;
  }): BlockchainAuditEntry[] {
    let entries = [...this.auditLog];

    if (filters?.evidenceId) {
      entries = entries.filter((e) => e.evidenceId === filters.evidenceId);
    }
    if (filters?.eventType) {
      entries = entries.filter((e) => e.eventType === filters.eventType);
    }
    if (filters?.startDate) {
      entries = entries.filter((e) => e.timestamp >= filters.startDate!);
    }
    if (filters?.endDate) {
      entries = entries.filter((e) => e.timestamp <= filters.endDate!);
    }

    return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Create integrity record
   */
  createIntegrityRecord(
    evidenceId: string,
    hash: string,
    previousHash?: string
  ): EvidenceIntegrityRecord {
    return evidenceHashingService.createIntegrityRecord(evidenceId, hash, previousHash);
  }

  /**
   * Update integrity record with verification
   */
  updateIntegrityRecord(
    record: EvidenceIntegrityRecord,
    verification: VerificationRecord
  ): EvidenceIntegrityRecord {
    return {
      ...record,
      currentHash: verification.hash,
      previousHash: record.currentHash !== verification.hash ? record.currentHash : record.previousHash,
      integrityState: verification.status === VerificationStatus.VERIFIED
        ? EvidenceIntegrityState.INTACT
        : verification.status === VerificationStatus.MODIFIED
          ? EvidenceIntegrityState.MODIFIED
          : EvidenceIntegrityState.UNKNOWN,
      lastVerifiedAt: verification.timestamp,
      lastVerificationStatus: verification.status,
      verificationHistory: [...record.verificationHistory, verification],
    };
  }

  /**
   * Get verification statistics
   */
  getVerificationStats(): {
    totalVerified: number;
    totalModified: number;
    totalFailed: number;
    unacknowledgedAlerts: number;
    auditEntries: number;
  } {
    const allHistory = Array.from(this.verificationHistory.values()).flat();
    const alerts = this.getUnacknowledgedAlerts();

    return {
      totalVerified: allHistory.filter((v) => v.status === VerificationStatus.VERIFIED).length,
      totalModified: allHistory.filter((v) => v.status === VerificationStatus.MODIFIED).length,
      totalFailed: allHistory.filter((v) => v.status === VerificationStatus.FAILED).length,
      unacknowledgedAlerts: alerts.length,
      auditEntries: this.auditLog.length,
    };
  }

  /**
   * Clear verification data (for testing)
   */
  clearVerificationData(): void {
    this.verificationHistory.clear();
    this.tamperAlerts.clear();
    this.auditLog = [];
    evidenceHashingService.clearCache();
  }
}

export const verificationService = new VerificationService();
export default verificationService;
