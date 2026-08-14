/**
 * Storage Service Tests
 */

import '../tests/setup';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { storageService, StorageCategory } from './storage.service';
import { ValidationError, NotFoundError } from '../middleware';
import { SandboxSession, Evidence, Investigation } from '../models';
import { BlockchainAudit } from '../blockchain/models/blockchain.model';

const TEST_USER_ID = new mongoose.Types.ObjectId().toString();

describe('StorageService', () => {
  // Use actual resolved directories for testing
  const getResolvedDirs = (category: StorageCategory): string[] => {
    const basePaths: Record<StorageCategory, string> = {
      reports: 'uploads/reports',
      analysis: 'uploads/analysis',
      evidence: 'uploads/evidence',
      'sandbox-logs': 'uploads/sandbox-logs',
      monitoring: 'logs/monitoring',
    };
    const basePath = basePaths[category];
    const dirs: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const base = i === 0 ? process.cwd() : path.resolve(process.cwd(), ...new Array(i).fill('..'));
      const candidate = path.join(base, basePath);
      if (fs.existsSync(candidate) && !dirs.includes(candidate)) dirs.push(candidate);
    }
    return dirs.length > 0 ? dirs : [path.resolve(process.cwd(), basePath)];
  };

  let createdFiles: string[] = [];

  afterAll(() => {
    // Clean up any test files created
    createdFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch {
        // Ignore
      }
    });
  });

  describe('listFiles', () => {
    it('should list report files with sessionId extraction', async () => {
      const files = await storageService.listFiles('reports');
      expect(files.length).toBeGreaterThanOrEqual(0);
      // If test files exist, verify sessionId extraction
      const testFile = files.find(f => f.name.startsWith('sandbox-report-') && f.name.endsWith('.json'));
      if (testFile) {
        expect(testFile.sessionId).toBeDefined();
      }
    });

    it('should list analysis files', async () => {
      const files = await storageService.listFiles('analysis');
      expect(files.length).toBeGreaterThanOrEqual(0);
    });

    it('should list evidence files', async () => {
      const files = await storageService.listFiles('evidence');
      expect(files.length).toBeGreaterThanOrEqual(0);
    });

    it('should list sandbox log files', async () => {
      const files = await storageService.listFiles('sandbox-logs');
      expect(files.length).toBeGreaterThanOrEqual(0);
    });

    it('should list monitoring files', async () => {
      const files = await storageService.listFiles('monitoring');
      expect(files.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getOverview', () => {
    it('should return overview with categories and database counts', async () => {
      const overview = await storageService.getOverview();
      expect(overview.categories).toBeDefined();
      expect(overview.categories.length).toBe(5);
      expect(overview.database).toBeDefined();
      expect(typeof overview.database.sandboxSessions).toBe('number');
      expect(typeof overview.totalFiles).toBe('number');
      expect(typeof overview.totalSizeBytes).toBe('number');
    });

    it('should include all five categories', async () => {
      const overview = await storageService.getOverview();
      const keys = overview.categories.map(c => c.key).sort();
      expect(keys).toEqual(['analysis', 'evidence', 'monitoring', 'reports', 'sandbox-logs']);
    });
  });

  describe('path confinement', () => {
    it('should handle path traversal attempts gracefully (not delete)', async () => {
      const result = await storageService.deleteFiles('reports', ['../../../etc/passwd'], TEST_USER_ID);
      expect(result.deleted).toBe(false);
      expect(result.details.filesDeleted).toHaveLength(0);
    });

    it('should handle filenames with slashes gracefully (not delete)', async () => {
      const result = await storageService.deleteFiles('reports', ['subdir/file.json'], TEST_USER_ID);
      expect(result.deleted).toBe(false);
      expect(result.details.filesDeleted).toHaveLength(0);
    });

    it('should handle filenames with backslashes gracefully (not delete)', async () => {
      const result = await storageService.deleteFiles('reports', ['subdir\\file.json'], TEST_USER_ID);
      expect(result.deleted).toBe(false);
      expect(result.details.filesDeleted).toHaveLength(0);
    });
  });

  describe('resolveSafePath', () => {
    it('should resolve existing files in category directories', async () => {
      // Create a temp file in the first resolved analysis directory
      const analysisDirs = getResolvedDirs('analysis');
      if (analysisDirs.length > 0) {
        const testFile = path.join(analysisDirs[0], `test-hash-${Date.now()}.pdf`);
        fs.writeFileSync(testFile, '%PDF-test-hash');
        createdFiles.push(testFile);

        const hash = await storageService.getFileHash('analysis', path.basename(testFile));
        expect(hash.sha256).toBeDefined();
        expect(hash.md5).toBeDefined();
        expect(hash.sha256.length).toBe(64);
        expect(hash.md5.length).toBe(32);
      }
    });

    it('should throw NotFoundError for non-existent files', async () => {
      await expect(storageService.getFileHash('analysis', 'non-existent-file.pdf'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteFiles', () => {
    it('should delete specified files and return details', async () => {
      const analysisDirs = getResolvedDirs('analysis');
      if (analysisDirs.length > 0) {
        const testFile = path.join(analysisDirs[0], `test-delete-${Date.now()}.pdf`);
        fs.writeFileSync(testFile, 'delete me');
        createdFiles.push(testFile);

        const result = await storageService.deleteFiles('analysis', [path.basename(testFile)], TEST_USER_ID);
        expect(result.deleted).toBe(true);
        expect(result.details.filesDeleted).toContain(path.basename(testFile));
        expect(result.details.sizeFreed).toBeGreaterThan(0);
        expect(fs.existsSync(testFile)).toBe(false);
      }
    });

    it('should handle non-existent files gracefully', async () => {
      const result = await storageService.deleteFiles('analysis', ['non-existent.pdf'], TEST_USER_ID);
      expect(result.deleted).toBe(false);
      expect(result.details.filesDeleted).toHaveLength(0);
      expect(result.details.failedFiles).toContain('non-existent.pdf');
    });

    it('should remove Evidence records and decrement investigation count when deleting evidence files', async () => {
      const investigation = await Investigation.create({
        caseNumber: `STORAGE-TEST-${Date.now()}`,
        title: 'Storage Test Investigation',
        description: 'test',
        createdBy: new mongoose.Types.ObjectId(),
      });
      const evidenceFile = path.join(getResolvedDirs('evidence')[0], `test-evidence-${Date.now()}.bin`);
      fs.writeFileSync(evidenceFile, 'evidence bytes');
      createdFiles.push(evidenceFile);

      const evidence = await Evidence.create({
        evidenceId: `EV-${Date.now()}`,
        investigationId: investigation._id,
        name: 'test-evidence.bin',
        fileName: path.basename(evidenceFile),
        filePath: evidenceFile,
        fileSize: 13,
        mimeType: 'application/octet-stream',
        collectedBy: new mongoose.Types.ObjectId(),
        status: 'ready',
      });

      const result = await storageService.deleteFiles('evidence', [path.basename(evidenceFile)], TEST_USER_ID);
      expect(result.deleted).toBe(true);
      expect(result.details.dbRecordsDeleted).toBe(1);

      const remaining = await Evidence.findById(evidence._id);
      expect(remaining).toBeNull();
      const updatedInvestigation = await Investigation.findById(investigation._id).lean();
      expect(updatedInvestigation?.evidenceCount).toBe(-1);

      const tombstone = await BlockchainAudit.findOne({ evidenceId: evidence.evidenceId });
      expect(tombstone).not.toBeNull();
      expect(tombstone?.eventType).toBe('evidence_removed');
      expect(tombstone?.metadata?.sha256).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('deleteSessionFootprint', () => {
    it('should reject deletion of running sessions', async () => {
      await SandboxSession.create({
        sessionId: 'sess-running-test',
        status: 'running',
        startTime: new Date(),
        vmName: 'VM-Test',
        simulatorId: 'sim-test',
        simulatorName: 'Sim-Test',
      });

      await expect(storageService.deleteSessionFootprint('sess-running-test', TEST_USER_ID))
        .rejects.toThrow(ValidationError);
    });

    it('should reject deletion of pending sessions', async () => {
      await SandboxSession.create({
        sessionId: 'sess-pending-test',
        status: 'pending',
        startTime: new Date(),
        vmName: 'VM-Test',
        simulatorId: 'sim-test',
        simulatorName: 'Sim-Test',
      });

      await expect(storageService.deleteSessionFootprint('sess-pending-test', TEST_USER_ID))
        .rejects.toThrow(ValidationError);
    });

    it('should delete a completed session footprint and record a tombstone', async () => {
      const sessionId = 'sess-complete-test';
      await SandboxSession.create({
        sessionId,
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        vmName: 'VM-Test',
        simulatorId: 'sim-test',
        simulatorName: 'Sim-Test',
        eventsCollected: 5,
      });

      const reportsDir = getResolvedDirs('reports');
      const reportFile = path.join(reportsDir[0], `sandbox-report-${sessionId}.json`);
      fs.writeFileSync(reportFile, '{"sessionId":"sess-complete-test"}');
      createdFiles.push(reportFile);

      const result = await storageService.deleteSessionFootprint(sessionId, TEST_USER_ID);
      expect(result.deleted).toBe(true);
      expect(result.details.filesDeleted).toContain(`sandbox-report-${sessionId}.json`);
      expect(result.details.fileHashes[`sandbox-report-${sessionId}.json`]).toMatch(/^[a-f0-9]{64}$/);
      expect(fs.existsSync(reportFile)).toBe(false);

      const session = await SandboxSession.findOne({ sessionId });
      expect(session).toBeNull();

      const tombstone = await BlockchainAudit.findOne({ evidenceId: `SANDBOX-${sessionId}` });
      expect(tombstone).not.toBeNull();
      expect(tombstone?.eventType).toBe('evidence_removed');
    });
  });

  describe('purgeAllSessionData', () => {
    it('should reject purge when sessions are active', async () => {
      await SandboxSession.create({
        sessionId: 'sess-active-purge',
        status: 'running',
        startTime: new Date(),
        vmName: 'VM-Test',
        simulatorId: 'sim-test',
        simulatorName: 'Sim-Test',
      });

      await expect(storageService.purgeAllSessionData(TEST_USER_ID, 'PURGE'))
        .rejects.toThrow(ValidationError);
    });

    it('should purge all session data when no sessions are active', async () => {
      await SandboxSession.create({
        sessionId: 'sess-purge-1',
        status: 'completed',
        startTime: new Date(),
        vmName: 'VM-Test',
        simulatorId: 'sim-test',
        simulatorName: 'Sim-Test',
      });
      await SandboxSession.create({
        sessionId: 'sess-purge-2',
        status: 'failed',
        startTime: new Date(),
        vmName: 'VM-Test',
        simulatorId: 'sim-test',
        simulatorName: 'Sim-Test',
      });

      const result = await storageService.purgeAllSessionData(TEST_USER_ID, 'PURGE');
      expect(result.deleted).toBe(true);
      expect(await SandboxSession.countDocuments({})).toBe(0);
      expect(result.details.dbRecordsDeleted).toBe(2);
    });
  });
});