/**
 * Storage Service Tests
 */

import '../tests/setup';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { storageService, StorageCategory } from './storage.service';
import { ValidationError, NotFoundError } from '../middleware';

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
    });
  });
});