/**
 * Distributed Verification Service
 * Handles parallel verification workflows and scheduling
 */

import logger from '../config/logger';
import { BlockchainVerification, EvidenceIntegrity, BlockchainAudit } from './models/blockchain.model';
import { blockchainService } from './blockchain.service';
import { evidenceHashingService } from './hashing.service';
import { VerificationStatus, EvidenceIntegrityState, BlockchainEventType } from './types';
import { v4 as uuidv4 } from 'uuid';

export interface VerificationJob {
  id: string;
  type: 'single' | 'batch' | 'scheduled' | 'reconciliation';
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  evidenceIds: string[];
  filePaths?: string[];
  userId: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: number;
  results?: VerificationJobResult[];
  error?: string;
}

export interface VerificationJobResult {
  evidenceId: string;
  status: VerificationStatus;
  verified: boolean;
  currentHash?: string;
  integrityState?: EvidenceIntegrityState;
  verificationTime?: number;
  error?: string;
}

export interface VerificationSchedule {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  evidenceFilter: {
    investigationId?: string;
    status?: string;
    lastVerifiedBefore?: number;
  };
  createdBy: string;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
}

export class DistributedVerificationService {
  private jobQueue: VerificationJob[] = [];
  private schedules: VerificationSchedule[] = [];
  private isWorkerRunning = false;
  private readonly MAX_CONCURRENT = 5;
  private readonly MAX_QUEUE_SIZE = 1000;

  /**
   * Create verification job
   */
  async createJob(
    type: VerificationJob['type'],
    evidenceIds: string[],
    userId: string,
    priority: VerificationJob['priority'] = 'normal',
    filePaths?: string[]
  ): Promise<string> {
    if (this.jobQueue.length >= this.MAX_QUEUE_SIZE) {
      throw new Error('Verification queue is full');
    }

    const job: VerificationJob = {
      id: uuidv4(),
      type,
      priority,
      status: 'queued',
      evidenceIds,
      filePaths,
      userId,
      createdAt: new Date(),
      progress: 0,
    };

    // Insert based on priority
    this.insertJobByPriority(job);

    return job.id;
  }

  /**
   * Insert job by priority
   */
  private insertJobByPriority(job: VerificationJob): void {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const priority = priorityOrder[job.priority];

    let insertIndex = this.jobQueue.findIndex(j =>
      priorityOrder[j.priority] > priority
    );

    if (insertIndex === -1) {
      this.jobQueue.push(job);
    } else {
      this.jobQueue.splice(insertIndex, 0, job);
    }
  }

  /**
   * Start verification worker
   */
  async startWorker(): Promise<void> {
    if (this.isWorkerRunning) return;

    this.isWorkerRunning = true;
    logger.info('[VerificationWorker] Started');

    this.processQueue();
  }

  /**
   * Stop verification worker
   */
  async stopWorker(): Promise<void> {
    this.isWorkerRunning = false;
    logger.info('[VerificationWorker] Stopped');
  }

  /**
   * Process verification queue
   */
  private async processQueue(): Promise<void> {
    if (!this.isWorkerRunning) return;

    try {
      // Get jobs ready to process
      const readyJobs = this.jobQueue
        .filter(j => j.status === 'queued')
        .slice(0, this.MAX_CONCURRENT);

      const processingJobs = this.jobQueue.filter(j => j.status === 'processing');

      if (readyJobs.length === 0 && processingJobs.length === 0) {
        setTimeout(() => this.processQueue(), 1000);
        return;
      }

      // Process ready jobs
      for (const job of readyJobs) {
        job.status = 'processing';
        job.startedAt = new Date();

        this.processJob(job).catch(async (error) => {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : 'Unknown error';
          job.completedAt = new Date();

          await this.logAudit(null, BlockchainEventType.VERIFICATION_FAILED,
            `Verification job ${job.id} failed: ${job.error}`, 'system');
        });
      }

      // Update progress for processing jobs
      for (const job of processingJobs) {
        const completed = job.results?.filter(r => r).length || 0;
        job.progress = (completed / job.evidenceIds.length) * 100;
      }
    } catch (error) {
      logger.error('[VerificationWorker] Queue processing error:', error);
    }

    // Schedule next iteration
    setTimeout(() => this.processQueue(), 500);
  }

  /**
   * Process individual verification job
   */
  private async processJob(job: VerificationJob): Promise<void> {
    const results: VerificationJobResult[] = [];

    // Process in parallel with batching
    const batchSize = 10;
    for (let i = 0; i < job.evidenceIds.length; i += batchSize) {
      const batch = job.evidenceIds.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (evidenceId, index) => {
          const startTime = Date.now();

          try {
            const result = await this.verifyEvidence(evidenceId, job.userId);

            return {
              evidenceId,
              status: result.status,
              verified: result.verified,
              currentHash: result.currentHash,
              integrityState: result.integrityState,
              verificationTime: Date.now() - startTime,
            } as VerificationJobResult;
          } catch (error) {
            return {
              evidenceId,
              status: VerificationStatus.FAILED,
              verified: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              verificationTime: Date.now() - startTime,
            } as VerificationJobResult;
          }
        })
      );

      results.push(...batchResults);
      job.results = results;
      job.progress = ((i + batch.length) / job.evidenceIds.length) * 100;
    }

    job.status = 'completed';
    job.completedAt = new Date();
    job.progress = 100;

    // Log completion
    const successCount = results.filter(r => r.verified).length;
    await this.logAudit(null, BlockchainEventType.EVIDENCE_VERIFIED,
      `Verification job ${job.id} completed: ${successCount}/${results.length} verified`,
      job.userId, { jobType: job.type, total: results.length, verified: successCount });
  }

  /**
   * Verify single evidence
   */
  private async verifyEvidence(
    evidenceId: string,
    userId: string
  ): Promise<{
    status: VerificationStatus;
    verified: boolean;
    currentHash?: string;
    integrityState?: EvidenceIntegrityState;
  }> {
    // Get verification record
    const verification = await BlockchainVerification.findOne({ evidenceId });
    if (!verification) {
      throw new Error(`Verification record not found for ${evidenceId}`);
    }

    // Get current file hash
    const evidence = await (await import('../models')).Evidence.findById(evidenceId);
    if (!evidence) {
      throw new Error(`Evidence not found: ${evidenceId}`);
    }

    // Calculate current hash
    const currentHash = await evidenceHashingService.generateFileFingerprint(
      evidence.filePath
    );

    // Compare hashes
    const verified = currentHash === verification.fingerprint;
    const status = verified ? VerificationStatus.VERIFIED : VerificationStatus.MODIFIED;
    const integrityState = verified ? EvidenceIntegrityState.INTACT : EvidenceIntegrityState.MODIFIED;

    // Update verification record
    verification.verificationResult = verified;
    verification.verifiedAt = new Date();
    verification.status = status;
    await verification.save();

    // Update integrity record
    let integrity = await EvidenceIntegrity.findOne({ evidenceId });
    if (integrity) {
      integrity.currentHash = currentHash;
      integrity.integrityState = integrityState;
      integrity.lastVerifiedAt = new Date();
      integrity.lastVerificationStatus = status;
      integrity.verificationHistory.push({
        id: uuidv4(),
        timestamp: new Date(),
        hash: currentHash,
        status,
        method: 'both',
        verifiedBy: userId,
        details: verified ? 'Verified successfully' : 'Hash mismatch detected',
      });

      if (!verified) {
        integrity.tamperAlerts.push({
          id: uuidv4(),
          timestamp: new Date(),
          evidenceId,
          detectedAt: new Date(),
          expectedHash: verification.fingerprint,
          actualHash: currentHash,
          severity: 'high',
          acknowledged: false,
        });
      }

      await integrity.save();
    }

    return { status, verified, currentHash, integrityState };
  }

  /**
   * Create verification schedule
   */
  async createSchedule(
    name: string,
    cronExpression: string,
    evidenceFilter: VerificationSchedule['evidenceFilter'],
    createdBy: string
  ): Promise<string> {
    const schedule: VerificationSchedule = {
      id: uuidv4(),
      name,
      cronExpression,
      enabled: true,
      evidenceFilter,
      createdBy,
      createdAt: new Date(),
    };

    this.schedules.push(schedule);
    return schedule.id;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): VerificationJob | null {
    return this.jobQueue.find(j => j.id === jobId) || null;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    totalJobs: number;
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    byPriority: Record<string, number>;
  } {
    return {
      totalJobs: this.jobQueue.length,
      queued: this.jobQueue.filter(j => j.status === 'queued').length,
      processing: this.jobQueue.filter(j => j.status === 'processing').length,
      completed: this.jobQueue.filter(j => j.status === 'completed').length,
      failed: this.jobQueue.filter(j => j.status === 'failed').length,
      byPriority: {
        critical: this.jobQueue.filter(j => j.priority === 'critical').length,
        high: this.jobQueue.filter(j => j.priority === 'high').length,
        normal: this.jobQueue.filter(j => j.priority === 'normal').length,
        low: this.jobQueue.filter(j => j.priority === 'low').length,
      },
    };
  }

  /**
   * Get schedules
   */
  getSchedules(): VerificationSchedule[] {
    return [...this.schedules];
  }

  /**
   * Cancel job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobQueue.find(j => j.id === jobId);
    if (job && job.status === 'queued') {
      job.status = 'failed';
      job.error = 'Cancelled by user';
      return true;
    }
    return false;
  }

  /**
   * Get verification statistics
   */
  getVerificationStats(): {
    totalProcessed: number;
    verifiedCount: number;
    modifiedCount: number;
    failedCount: number;
    averageVerificationTime: number;
  } {
    const completed = this.jobQueue.filter(j => j.status === 'completed');

    let verifiedCount = 0;
    let modifiedCount = 0;
    let failedCount = 0;
    let totalTime = 0;
    let count = 0;

    for (const job of completed) {
      if (job.results) {
        for (const result of job.results) {
          if (result.verified) verifiedCount++;
          else if (result.status === VerificationStatus.MODIFIED) modifiedCount++;
          else if (result.status === VerificationStatus.FAILED) failedCount++;

          if (result.verificationTime) {
            totalTime += result.verificationTime;
            count++;
          }
        }
      }
    }

    return {
      totalProcessed: completed.length,
      verifiedCount,
      modifiedCount,
      failedCount,
      averageVerificationTime: count > 0 ? Math.round(totalTime / count) : 0,
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
      logger.error('[DistributedVerification] Failed to log audit:', error);
    }
  }
}

export const distributedVerificationService = new DistributedVerificationService();
export default distributedVerificationService;