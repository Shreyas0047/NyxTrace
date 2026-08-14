/**
 * Storage Management Service
 * Handles file storage operations, session footprint deletion, and audit logging
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SandboxSession, TelemetryEvent, AnalysisReport, AuditLog, Evidence } from '../models';
import { NotFoundError, ValidationError } from '../middleware';
import { config } from '../config';
import logger from '../config/logger';

export type StorageCategory = 'reports' | 'analysis' | 'evidence' | 'sandbox-logs' | 'monitoring';

export interface StorageCategoryInfo {
  key: StorageCategory;
  label: string;
  path: string;
  fileCount: number;
  sizeBytes: number;
  lastModified: Date | null;
}

export interface StorageOverview {
  categories: StorageCategoryInfo[];
  database: {
    sandboxSessions: number;
    telemetryEvents: number;
    analysisReports: number;
    reports: number;
    evidence: number;
    alerts: number;
    investigations: number;
  };
  totalFiles: number;
  totalSizeBytes: number;
}

export interface FileInfo {
  name: string;
  size: number;
  mtime: Date;
  sessionId?: string;
  linkedEvidenceId?: string;
}

export interface SessionFootprintInfo {
  session: any;
  reportFile: FileInfo | null;
  telemetryCount: number;
  monitoringLogFiles: FileInfo[];
}

export interface DeleteResult {
  deleted: boolean;
  message: string;
  details: {
    filesDeleted: string[];
    dbRecordsDeleted: number;
    sizeFreed: number;
    failedFiles: string[];
    fileHashes: Record<string, string>;
  };
}

const CATEGORY_CONFIG: Record<StorageCategory, { basePath: string; label: string }> = {
  reports: { basePath: 'uploads/reports', label: 'Session Reports' },
  analysis: { basePath: 'uploads/analysis', label: 'Document Analyses' },
  evidence: { basePath: 'uploads/evidence', label: 'Evidence Files' },
  'sandbox-logs': { basePath: 'uploads/sandbox-logs', label: 'Sandbox Logs' },
  monitoring: { basePath: 'logs/monitoring', label: 'Monitoring Logs' },
};

function resolveCategoryDirs(category: StorageCategory): string[] {
  const { basePath } = CATEGORY_CONFIG[category];
  const dirs: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    const base = i === 0 ? process.cwd() : path.resolve(process.cwd(), ...new Array(i).fill('..'));
    const candidate = path.join(base, basePath);
    if (fs.existsSync(candidate) && !dirs.includes(candidate)) {
      dirs.push(candidate);
    }
  }
  if (dirs.length > 0) return dirs;
  return [path.resolve(process.cwd(), basePath)];
}

function resolveSafePath(category: StorageCategory, filename: string): string {
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new ValidationError('Invalid filename: path traversal not allowed', [
      { field: 'filename', message: 'Path traversal not allowed' },
    ]);
  }

  const dirs = resolveCategoryDirs(category);
  for (const dir of dirs) {
    const fullPath = path.join(dir, filename);
    if (fs.existsSync(fullPath)) {
      const resolvedDir = path.resolve(dir);
      const resolvedFull = path.resolve(fullPath);
      if (!resolvedFull.startsWith(resolvedDir)) {
        throw new ValidationError('Invalid file path', [
          { field: 'filename', message: 'Invalid file path' },
        ]);
      }
      return fullPath;
    }
  }
  throw new NotFoundError(`File not found in ${CATEGORY_CONFIG[category].label}`);
}

function extractSessionIdFromFilename(filename: string): string | undefined {
  const match = filename.match(/^sandbox-report-(.+)\.json$/);
  if (match) return match[1];
  return undefined;
}

/**
 * Stream a file through SHA-256 so memory use is bounded regardless of size.
 */
function hashFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

const ACTIVE_SESSION_STATUSES = ['running', 'pending'];

export class StorageService {
  async getOverview(): Promise<StorageOverview> {
    const categories: StorageCategoryInfo[] = [];
    let totalFiles = 0;
    let totalSizeBytes = 0;

    for (const [key, cfg] of Object.entries(CATEGORY_CONFIG)) {
      const category = key as StorageCategory;
      const dirs = resolveCategoryDirs(category);
      let fileCount = 0;
      let sizeBytes = 0;
      let lastModified: Date | null = null;

      for (const dir of dirs) {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            try {
              const stats = fs.statSync(filePath);
              if (stats.isFile()) {
                fileCount += 1;
                sizeBytes += stats.size;
                if (!lastModified || stats.mtime > lastModified) {
                  lastModified = stats.mtime;
                }
              }
            } catch {
              // Ignore stat errors
            }
          }
        }
      }

      categories.push({
        key: category,
        label: cfg.label,
        path: dirs.join(', '),
        fileCount,
        sizeBytes,
        lastModified,
      });

      totalFiles += fileCount;
      totalSizeBytes += sizeBytes;
    }

    const [sandboxSessions, telemetryEvents, analysisReports, reports, evidence, alerts, investigations] = await Promise.all([
      SandboxSession.countDocuments({}),
      TelemetryEvent.countDocuments({}),
      AnalysisReport.countDocuments({}),
      (await import('../models')).Report.countDocuments({}),
      Evidence.countDocuments({}),
      (await import('../models')).Alert.countDocuments({}),
      (await import('../models')).Investigation.countDocuments({}),
    ]);

    return {
      categories,
      database: {
        sandboxSessions,
        telemetryEvents,
        analysisReports,
        reports,
        evidence,
        alerts,
        investigations,
      },
      totalFiles,
      totalSizeBytes,
    };
  }

  async listFiles(category: StorageCategory): Promise<FileInfo[]> {
    const dirs = resolveCategoryDirs(category);
    const files: FileInfo[] = [];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;

      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const filePath = path.join(dir, entry);
        try {
          const stats = fs.statSync(filePath);
          if (!stats.isFile()) continue;

          const fileInfo: FileInfo = {
            name: entry,
            size: stats.size,
            mtime: stats.mtime,
          };

          if (category === 'reports') {
            fileInfo.sessionId = extractSessionIdFromFilename(entry);
          }

          if (category === 'evidence') {
            const evidenceRecord = await Evidence.findOne({ filePath }).lean();
            if (evidenceRecord) {
              fileInfo.linkedEvidenceId = (evidenceRecord as any)._id.toString();
            }
          }

          files.push(fileInfo);
        } catch {
          // Ignore stat errors
        }
      }
    }

    return files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  }

  async listSessions(): Promise<SessionFootprintInfo[]> {
    const sessions = await SandboxSession.find({}).sort({ startTime: -1 }).lean();
    const results: SessionFootprintInfo[] = [];

    for (const session of sessions) {
      const reportFiles = await this.listFiles('reports');
      const reportFile = reportFiles.find(f => f.sessionId === session.sessionId) || null;
      const telemetryCount = await TelemetryEvent.countDocuments({ sessionId: session.sessionId });
      const monitoringFiles = await this.listFiles('monitoring');
      const sessionMonitoringFiles = monitoringFiles.filter(f => f.name.includes(session.sessionId));

      results.push({
        session,
        reportFile,
        telemetryCount,
        monitoringLogFiles: sessionMonitoringFiles,
      });
    }

    return results;
  }

  async deleteSessionFootprint(sessionId: string, userId: string): Promise<DeleteResult> {
    const session = await SandboxSession.findOne({ sessionId });
    if (!session) {
      throw new NotFoundError(`Sandbox session ${sessionId}`);
    }

    if (ACTIVE_SESSION_STATUSES.includes(session.status)) {
      throw new ValidationError(
        `Cannot delete active sandbox session (status: ${session.status})`,
        [{ field: 'sessionId', message: 'Terminate the sandbox session before deleting its footprint' }]
      );
    }

    const details: DeleteResult['details'] = {
      filesDeleted: [],
      dbRecordsDeleted: 0,
      sizeFreed: 0,
      failedFiles: [],
      fileHashes: {},
    };

    // Delete report file(s) across all reports dirs
    const reportFiles = await this.listFiles('reports');
    const sessionReportFiles = reportFiles.filter(f => f.sessionId === sessionId);
    for (const file of sessionReportFiles) {
      try {
        const filePath = resolveSafePath('reports', file.name);
        const stats = fs.statSync(filePath);
        try {
          details.fileHashes[file.name] = await hashFileSha256(filePath);
        } catch {
          // Hash is best-effort; deletion proceeds
        }
        fs.unlinkSync(filePath);
        details.filesDeleted.push(file.name);
        details.sizeFreed += stats.size;
      } catch (error) {
        details.failedFiles.push(file.name);
        logger.warn(`Failed to delete report file ${file.name}:`, error);
      }
    }

    // Delete monitoring log files for this session
    const monitoringFiles = await this.listFiles('monitoring');
    const sessionMonitoringFiles = monitoringFiles.filter(f => f.name.includes(sessionId));
    for (const file of sessionMonitoringFiles) {
      try {
        const filePath = resolveSafePath('monitoring', file.name);
        const stats = fs.statSync(filePath);
        fs.unlinkSync(filePath);
        details.filesDeleted.push(file.name);
        details.sizeFreed += stats.size;
      } catch (error) {
        details.failedFiles.push(file.name);
        logger.warn(`Failed to delete monitoring file ${file.name}:`, error);
      }
    }

    // Delete sandbox logs for this session
    const sandboxLogFiles = await this.listFiles('sandbox-logs');
    const sessionSandboxLogs = sandboxLogFiles.filter(f => f.name.includes(sessionId));
    for (const file of sessionSandboxLogs) {
      try {
        const filePath = resolveSafePath('sandbox-logs', file.name);
        const stats = fs.statSync(filePath);
        fs.unlinkSync(filePath);
        details.filesDeleted.push(file.name);
        details.sizeFreed += stats.size;
      } catch (error) {
        details.failedFiles.push(file.name);
        logger.warn(`Failed to delete sandbox log ${file.name}:`, error);
      }
    }

    // Delete telemetry events
    const telemetryResult = await TelemetryEvent.deleteMany({ sessionId });
    details.dbRecordsDeleted += telemetryResult.deletedCount || 0;

    // Delete the sandbox session
    await SandboxSession.findByIdAndDelete(session._id);
    details.dbRecordsDeleted += 1;

    // Record a blockchain tombstone so on-chain integrity records are explained
    await this.addRemovalTombstone(
      `SANDBOX-${sessionId}`,
      userId,
      `Sandbox session footprint deleted: ${sessionId}`,
      { sessionId, filesDeleted: details.filesDeleted, fileHashes: details.fileHashes }
    );

    // Audit log
    await AuditLog.create({
      userId,
      action: 'SESSION_FOOTPRINT_DELETED',
      entityType: 'storage',
      entityId: sessionId,
      details: {
        sessionId,
        filesDeleted: details.filesDeleted,
        failedFiles: details.failedFiles,
        fileHashes: details.fileHashes,
        telemetryEventsDeleted: telemetryResult.deletedCount,
        sizeFreed: details.sizeFreed,
      },
      ipAddress: 'system',
      status: 'success',
    });

    return {
      deleted: true,
      message: `Deleted session ${sessionId} footprint`,
      details,
    };
  }

  async deleteFiles(category: StorageCategory, names: string[], userId: string): Promise<DeleteResult> {
    const details: DeleteResult['details'] = {
      filesDeleted: [],
      dbRecordsDeleted: 0,
      sizeFreed: 0,
      failedFiles: [],
      fileHashes: {},
    };

    for (const name of names) {
      try {
        const filePath = resolveSafePath(category, name);
        const stats = fs.statSync(filePath);
        if (category === 'evidence') {
          try {
            details.fileHashes[name] = await hashFileSha256(filePath);
          } catch {
            // Hash is best-effort; deletion proceeds
          }
        }
        fs.unlinkSync(filePath);
        details.filesDeleted.push(name);
        details.sizeFreed += stats.size;
      } catch (error) {
        details.failedFiles.push(name);
        logger.warn(`Failed to delete file ${name} from ${category}:`, error);
      }
    }

    // If evidence files, also delete linked Evidence records (exact fileName match)
    if (category === 'evidence') {
      const { Investigation } = await import('../models');
      for (const name of names) {
        try {
          const evidenceRecord = await Evidence.findOne({ fileName: name }).lean();
          if (evidenceRecord) {
            const evidenceId = (evidenceRecord as any).evidenceId;
            await this.addRemovalTombstone(
              evidenceId,
              userId,
              `Evidence file deleted: ${name}`,
              { evidenceId, fileName: name, sha256: details.fileHashes[name] || null }
            );
            if ((evidenceRecord as any).investigationId) {
              await Investigation.updateOne(
                { _id: (evidenceRecord as any).investigationId },
                { $inc: { evidenceCount: -1 } }
              );
            }
            await Evidence.findByIdAndDelete((evidenceRecord as any)._id);
            details.dbRecordsDeleted += 1;
          }
        } catch (error) {
          logger.warn(`Failed to remove Evidence record for ${name}:`, error);
        }
      }
    }

    const fullyDeleted = details.filesDeleted.length === names.length;

    // Audit log
    await AuditLog.create({
      userId,
      action: 'STORAGE_FILE_DELETED',
      entityType: 'storage',
      entityId: category,
      details: {
        category,
        filesDeleted: details.filesDeleted,
        failedFiles: details.failedFiles,
        fileHashes: details.fileHashes,
        sizeFreed: details.sizeFreed,
      },
      ipAddress: 'system',
      status: fullyDeleted ? 'success' : 'failed',
    });

    return {
      deleted: details.filesDeleted.length > 0,
      message: fullyDeleted
        ? `Deleted ${details.filesDeleted.length} file(s) from ${CATEGORY_CONFIG[category].label}`
        : `Partially deleted: ${details.filesDeleted.length} of ${names.length} file(s) removed; ${details.failedFiles.length} failed`,
      details,
    };
  }

  async deleteEvidenceById(evidenceId: string, userId: string): Promise<DeleteResult> {
    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) {
      throw new NotFoundError('Evidence');
    }

    const details: DeleteResult['details'] = {
      filesDeleted: [],
      dbRecordsDeleted: 0,
      sizeFreed: 0,
      failedFiles: [],
      fileHashes: {},
    };

    if (fs.existsSync(evidence.filePath)) {
      const stats = fs.statSync(evidence.filePath);
      const fileName = path.basename(evidence.filePath);
      try {
        details.fileHashes[fileName] = await hashFileSha256(evidence.filePath);
      } catch {
        // Hash is best-effort; deletion proceeds
      }
      fs.unlinkSync(evidence.filePath);
      details.filesDeleted.push(fileName);
      details.sizeFreed += stats.size;
    }

    const { Investigation } = await import('../models');
    if (evidence.investigationId) {
      await Investigation.updateOne(
        { _id: evidence.investigationId },
        { $inc: { evidenceCount: -1 } }
      );
    }

    await Evidence.findByIdAndDelete(evidenceId);
    details.dbRecordsDeleted += 1;

    // Tombstone: record the removal + pre-deletion hash against the on-chain integrity trail
    await this.addRemovalTombstone(
      evidence.evidenceId,
      userId,
      `Evidence deleted: ${evidence.name}`,
      {
        evidenceId: evidence.evidenceId,
        name: evidence.name,
        investigationId: evidence.investigationId,
        fileHashes: details.fileHashes,
      }
    );

    await AuditLog.create({
      userId,
      action: 'EVIDENCE_DELETED',
      entityType: 'evidence',
      entityId: evidenceId,
      details: {
        evidenceId: evidence.evidenceId,
        name: evidence.name,
        investigationId: evidence.investigationId,
        fileHashes: details.fileHashes,
      },
      ipAddress: 'system',
      status: 'success',
    });

    return {
      deleted: true,
      message: `Deleted evidence ${evidence.evidenceId}`,
      details,
    };
  }

  async purgeCategory(category: StorageCategory, userId: string): Promise<DeleteResult> {
    const files = await this.listFiles(category);
    const names = files.map(f => f.name);
    return this.deleteFiles(category, names, userId);
  }

  async purgeAllSessionData(userId: string, confirmToken: string): Promise<DeleteResult> {
    if (confirmToken !== 'PURGE') {
      throw new ValidationError('Invalid confirmation token. Must be "PURGE"', [
        { field: 'confirm', message: 'Must be "PURGE"' },
      ]);
    }

    const sessions = await SandboxSession.find({}).lean();
    const activeSessions = sessions.filter(s => ACTIVE_SESSION_STATUSES.includes(s.status));
    if (activeSessions.length > 0) {
      throw new ValidationError(
        `Cannot purge: ${activeSessions.length} sandbox session(s) are still active`,
        [{ field: 'confirm', message: 'Terminate all sandbox sessions before purging' }]
      );
    }

    const details: DeleteResult['details'] = {
      filesDeleted: [],
      dbRecordsDeleted: 0,
      sizeFreed: 0,
      failedFiles: [],
      fileHashes: {},
    };

    // Delete all report files (hashing each before removal)
    const reportFiles = await this.listFiles('reports');
    for (const file of reportFiles) {
      try {
        const filePath = resolveSafePath('reports', file.name);
        const stats = fs.statSync(filePath);
        try {
          details.fileHashes[file.name] = await hashFileSha256(filePath);
        } catch {
          // Hash is best-effort; deletion proceeds
        }
        fs.unlinkSync(filePath);
        details.filesDeleted.push(file.name);
        details.sizeFreed += stats.size;
      } catch (error) {
        details.failedFiles.push(file.name);
        logger.warn(`Failed to purge report file ${file.name}:`, error);
      }
    }

    // Delete all telemetry events in one pass
    const telemetryResult = await TelemetryEvent.deleteMany({});
    details.dbRecordsDeleted += telemetryResult.deletedCount || 0;

    // Delete all sessions
    const sessionDeleteResult = await SandboxSession.deleteMany({});
    details.dbRecordsDeleted += sessionDeleteResult.deletedCount || 0;

    // Record tombstones so on-chain integrity records are explained
    for (const session of sessions) {
      await this.addRemovalTombstone(
        `SANDBOX-${session.sessionId}`,
        userId,
        `Sandbox session footprint purged: ${session.sessionId}`,
        { sessionId: session.sessionId }
      );
    }

    await AuditLog.create({
      userId,
      action: 'STORAGE_PURGE_ALL',
      entityType: 'storage',
      entityId: 'all',
      details: {
        filesDeleted: details.filesDeleted,
        failedFiles: details.failedFiles,
        fileHashes: details.fileHashes,
        sessionsDeleted: sessionDeleteResult.deletedCount || 0,
        telemetryEventsDeleted: telemetryResult.deletedCount || 0,
        sizeFreed: details.sizeFreed,
      },
      ipAddress: 'system',
      status: 'success',
    });

    return {
      deleted: true,
      message: `Purged all session data: ${sessionDeleteResult.deletedCount || 0} sessions, ${details.filesDeleted.length} report files`,
      details,
    };
  }

  async getFileHash(category: StorageCategory, filename: string): Promise<{ sha256: string; md5: string }> {
    const filePath = resolveSafePath(category, filename);
    const sha256 = crypto.createHash('sha256');
    const md5 = crypto.createHash('md5');
    await new Promise<void>((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      stream.on('error', reject);
      stream.on('data', (chunk) => {
        sha256.update(chunk);
        md5.update(chunk);
      });
      stream.on('end', () => resolve());
    });
    return {
      sha256: sha256.digest('hex'),
      md5: md5.digest('hex'),
    };
  }

  /**
   * Record a blockchain audit tombstone for a removed artifact so on-chain
   * integrity records are distinguishable from tampering.
   */
  private async addRemovalTombstone(
    evidenceId: string | null,
    performedBy: string,
    details: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const { BlockchainAudit, EvidenceIntegrity } = await import('../blockchain/models/blockchain.model');
      const { BlockchainEventType, EvidenceIntegrityState } = await import('../blockchain/types');
      await BlockchainAudit.create({
        evidenceId,
        eventType: BlockchainEventType.EVIDENCE_REMOVED,
        details,
        performedBy,
        metadata,
      });
      if (evidenceId) {
        await EvidenceIntegrity.updateOne(
          { evidenceId },
          { $set: { integrityState: EvidenceIntegrityState.VERIFICATION_FAILED } }
        );
      }
    } catch (error) {
      logger.warn(`Failed to record removal tombstone for ${evidenceId}:`, error);
    }
  }
}

export const storageService = new StorageService();
export default storageService;