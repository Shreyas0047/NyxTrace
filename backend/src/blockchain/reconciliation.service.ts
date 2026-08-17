/**
 * Blockchain Reconciliation Service
 * Handles detection and resolution of blockchain inconsistencies
 */

import logger from '../config/logger';
import { BlockchainVerification, EvidenceIntegrity, BlockchainAudit, BlockchainVerificationStatus } from './models/blockchain.model';
import { blockchainService } from './blockchain.service';
import { blockchainSyncService } from './synchronization.service';
import { VerificationStatus, EvidenceIntegrityState, BlockchainEventType } from './types';
import { v4 as uuidv4 } from 'uuid';

export interface ReconciliationIssue {
  id: string;
  type: 'hash_mismatch' | 'orphan_record' | 'sync_failure' | 'transaction_failure' | 'drift_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidenceId?: string;
  description: string;
  detectedAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolution?: string;
  automatic: boolean;
}

export interface ReconciliationReport {
  id: string;
  timestamp: Date;
  issuesFound: number;
  issuesResolved: number;
  issuesRemaining: number;
  recommendations: string[];
  details: ReconciliationIssue[];
}

export class BlockchainReconciliationService {
  private activeIssues: Map<string, ReconciliationIssue> = new Map();

  /**
   * Perform full reconciliation check
   */
  async performFullReconciliation(): Promise<ReconciliationReport> {
    const issues: ReconciliationIssue[] = [];
    let resolved = 0;

    logger.info('[Reconciliation] Starting full reconciliation...');

    // Check 1: Hash consistency between verification and integrity records
    const verificationRecords = await BlockchainVerification.find().lean();
    for (const verification of verificationRecords) {
      const integrity = await EvidenceIntegrity.findOne({ evidenceId: verification.evidenceId });

      if (!integrity) {
        const issue = this.createIssue('orphan_record', 'high', String(verification.evidenceId),
          'Verification record exists but no integrity record');
        issues.push(issue);
      } else if (verification.fingerprint !== integrity.currentHash) {
        const issue = this.createIssue('hash_mismatch', 'critical', String(verification.evidenceId),
          `Hash mismatch: verification has ${verification.fingerprint.substring(0, 16)}... but integrity has ${integrity.currentHash.substring(0, 16)}...`);
        issues.push(issue);
      }
    }

    // Check 2: Verify integrity records have corresponding verification
    const integrityRecords = await EvidenceIntegrity.find().lean();
    for (const integrity of integrityRecords) {
      const verification = await BlockchainVerification.findOne({ evidenceId: integrity.evidenceId });

      if (!verification) {
        const issue = this.createIssue('orphan_record', 'medium', String(integrity.evidenceId),
          'Integrity record exists but no verification record');
        issues.push(issue);
      }
    }

    // Check 3: Blockchain synchronization status
    const syncingRecords = await BlockchainVerification.find({
      status: VerificationStatus.SYNCING,
    }).lean();

    if (syncingRecords.length > 0) {
      // Check if these are stuck
      for (const record of syncingRecords) {
        const issue = this.createIssue('sync_failure', 'medium', String(record.evidenceId),
          'Verification stuck in syncing state');
        issues.push(issue);
      }
    }

    // Check 4: Failed transactions
    const failedRecords = await BlockchainVerification.find({
      status: VerificationStatus.FAILED,
    }).lean();

    for (const record of failedRecords) {
      const issue = this.createIssue('transaction_failure', 'high', String(record.evidenceId),
        'Blockchain transaction failed');
      issues.push(issue);
    }

    // Check 5: Evidence integrity drift
    for (const integrity of integrityRecords) {
      if (integrity.integrityState === EvidenceIntegrityState.MODIFIED) {
        const issue = this.createIssue('drift_detected', 'critical', String(integrity.evidenceId),
          `Evidence integrity drift detected - current state: ${integrity.integrityState}`);
        issues.push(issue);
      }
    }

    // Try to auto-resolve issues
    for (const issue of issues) {
      const resolvedIssue = await this.tryAutoResolve(issue);
      if (resolvedIssue) {
        resolved++;
      }
    }

    // Update active issues — build local accumulator first, then bulk-assign
    const newIssues = new Map<string, ReconciliationIssue>();
    for (const issue of issues.filter(i => !i.resolved)) {
      newIssues.set(issue.id, issue);
    }
    this.activeIssues = newIssues;

    const report: ReconciliationReport = {
      id: uuidv4(),
      timestamp: new Date(),
      issuesFound: issues.length,
      issuesResolved: resolved,
      issuesRemaining: issues.length - resolved,
      recommendations: this.generateRecommendations(issues),
      details: issues,
    };

    // Log to audit
    await this.logAudit(null, BlockchainEventType.CHAIN_SYNC_COMPLETE,
      `Reconciliation completed: ${issues.length} issues found, ${resolved} resolved`,
      'system', { issuesFound: issues.length, resolved, remaining: issues.length - resolved });

    logger.info(`[Reconciliation] Completed: ${issues.length} issues found, ${resolved} resolved`);

    return report;
  }

  /**
   * Create reconciliation issue
   */
  private createIssue(
    type: ReconciliationIssue['type'],
    severity: ReconciliationIssue['severity'],
    evidenceId: string,
    description: string
  ): ReconciliationIssue {
    return {
      id: uuidv4(),
      type,
      severity,
      evidenceId,
      description,
      detectedAt: new Date(),
      resolved: false,
      automatic: false,
    };
  }

  /**
   * Try to automatically resolve an issue
   */
  private async tryAutoResolve(issue: ReconciliationIssue): Promise<boolean> {
    if (!issue.evidenceId) return false;

    try {
      switch (issue.type) {
        case 'hash_mismatch':
          // Re-sync with blockchain
          const verification = await BlockchainVerification.findOne({ evidenceId: issue.evidenceId });
          if (verification) {
            await blockchainSyncService.queueEvidenceRegistration(
              issue.evidenceId,
              verification.fingerprint
            );
            issue.resolved = true;
            issue.resolution = 'Re-queued for blockchain sync';
            return true;
          }
          break;

        case 'orphan_record':
          // Create missing record
          const integrity = await EvidenceIntegrity.findOne({ evidenceId: issue.evidenceId });
          if (integrity) {
            await BlockchainVerification.create({
              evidenceId: issue.evidenceId,
              fingerprint: integrity.currentHash,
              algorithm: 'sha256',
              status: BlockchainVerificationStatus.PENDING,
              verifiedBy: 'system',
            });
            issue.resolved = true;
            issue.resolution = 'Created missing verification record';
            return true;
          }
          break;

        case 'sync_failure':
          // Retry sync
          await blockchainSyncService.queueEvidenceVerification(issue.evidenceId);
          issue.resolved = true;
          issue.resolution = 'Re-queued for verification';
          return true;

        case 'transaction_failure':
          // Retry registration
          const v = await BlockchainVerification.findOne({ evidenceId: issue.evidenceId });
          if (v) {
            await blockchainSyncService.queueEvidenceRegistration(issue.evidenceId, v.fingerprint);
            issue.resolved = true;
            issue.resolution = 'Re-queued for blockchain registration';
            return true;
          }
          break;

        case 'drift_detected':
          // Create alert for manual review
          issue.resolved = false;
          issue.resolution = 'Requires manual review - evidence modified';
          return false;
      }
    } catch (error) {
      logger.error(`[Reconciliation] Auto-resolution failed for ${issue.id}:`, error);
    }

    return false;
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(issues: ReconciliationIssue[]): string[] {
    const recommendations: string[] = [];
    const byType = new Map<string, number>();

    for (const issue of issues) {
      byType.set(issue.type, (byType.get(issue.type) || 0) + 1);
    }

    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    if (criticalCount > 0) {
      recommendations.push(`Critical: ${criticalCount} critical issues require immediate attention`);
    }

    const hashMismatchCount = byType.get('hash_mismatch') || 0;
    if (hashMismatchCount > 0) {
      recommendations.push(`${hashMismatchCount} hash mismatches detected - check for evidence tampering`);
    }

    const orphanCount = byType.get('orphan_record') || 0;
    if (orphanCount > 0) {
      recommendations.push(`${orphanCount} orphan records found - database integrity may be compromised`);
    }

    const syncFailures = byType.get('sync_failure') || 0;
    if (syncFailures > 0) {
      recommendations.push(`${syncFailures} sync failures - verify blockchain connectivity`);
    }

    if (issues.length === 0) {
      recommendations.push('No reconciliation issues detected - system is healthy');
    }

    return recommendations;
  }

  /**
   * Get active issues
   */
  getActiveIssues(): ReconciliationIssue[] {
    return Array.from(this.activeIssues.values());
  }

  /**
   * Get issues by severity
   */
  getIssuesBySeverity(severity: ReconciliationIssue['severity']): ReconciliationIssue[] {
    return Array.from(this.activeIssues.values()).filter(i => i.severity === severity);
  }

  /**
   * Acknowledge issue
   */
  async acknowledgeIssue(issueId: string, resolution: string): Promise<boolean> {
    const issue = this.activeIssues.get(issueId);
    if (issue) {
      issue.resolved = true;
      issue.resolvedAt = new Date();
      issue.resolution = resolution;

      await this.logAudit(issue.evidenceId || null, BlockchainEventType.EVIDENCE_VERIFIED,
        `Reconciliation issue ${issueId} resolved: ${resolution}`, 'system');

      return true;
    }
    return false;
  }

  /**
   * Check specific evidence consistency
   */
  async checkEvidenceConsistency(evidenceId: string): Promise<{
    consistent: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    const verification = await BlockchainVerification.findOne({ evidenceId });
    const integrity = await EvidenceIntegrity.findOne({ evidenceId });

    if (!verification && !integrity) {
      issues.push('No blockchain records found for this evidence');
      return { consistent: false, issues };
    }

    if (!verification) {
      issues.push('Missing verification record');
    }

    if (!integrity) {
      issues.push('Missing integrity record');
    }

    if (verification && integrity) {
      if (verification.fingerprint !== integrity.currentHash) {
        issues.push('Hash mismatch between verification and integrity records');
      }

      if (verification.status === VerificationStatus.ON_CHAIN && !integrity.blockchainVerified) {
        issues.push('Verification shows on-chain but integrity not verified');
      }
    }

    return {
      consistent: issues.length === 0,
      issues,
    };
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
        performedBy: /^[0-9a-fA-F]{24}$/.test(performedBy) ? performedBy : undefined,
        metadata,
      });
    } catch (error) {
      logger.error('[Reconciliation] Failed to log audit:', error);
    }
  }

  /**
   * Get reconciliation statistics
   */
  async getReconciliationStats(): Promise<{
    totalIssues: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    resolvedToday: number;
    autoResolved: number;
  }> {
    const allIssues = await this.activeIssues.values();

    const bySeverity: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const byType: Record<string, number> = {};

    for (const issue of allIssues) {
      bySeverity[issue.severity]++;
      byType[issue.type] = (byType[issue.type] || 0) + 1;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const resolvedToday = Array.from(this.activeIssues.values())
      .filter(i => i.resolved && i.resolvedAt && i.resolvedAt >= today).length;

    const autoResolved = Array.from(this.activeIssues.values())
      .filter(i => i.resolved && i.automatic).length;

    return {
      totalIssues: this.activeIssues.size,
      bySeverity,
      byType,
      resolvedToday,
      autoResolved,
    };
  }
}

export const blockchainReconciliationService = new BlockchainReconciliationService();
export default blockchainReconciliationService;
