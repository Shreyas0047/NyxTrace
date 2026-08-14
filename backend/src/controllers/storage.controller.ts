/**
 * Storage Controller
 * Handles HTTP requests for storage management operations
 */

import { Response } from 'express';
import { storageService, StorageCategory, DeleteResult } from '../services/storage.service';
import { AuthenticatedRequest } from '../middleware';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export class StorageController {
  async getOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
    const overview = await storageService.getOverview();
    res.json({
      success: true,
      data: {
        ...overview,
        totalSizeFormatted: formatBytes(overview.totalSizeBytes),
        categories: overview.categories.map(c => ({
          ...c,
          sizeFormatted: formatBytes(c.sizeBytes),
        })),
      },
    });
  }

  async listFiles(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { key } = req.params;
    const validCategories: StorageCategory[] = ['reports', 'analysis', 'evidence', 'sandbox-logs', 'monitoring'];

    if (!validCategories.includes(key as StorageCategory)) {
      res.status(400).json({
        success: false,
        message: 'Invalid category',
        errors: [{ code: 'INVALID_CATEGORY', message: `Category must be one of: ${validCategories.join(', ')}` }],
      });
      return;
    }

    const files = await storageService.listFiles(key as StorageCategory);
    res.json({
      success: true,
      data: files.map(f => ({
        ...f,
        sizeFormatted: formatBytes(f.size),
      })),
    });
  }

  async listSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const sessions = await storageService.listSessions();
    res.json({
      success: true,
      data: sessions.map(s => ({
        session: s.session,
        reportFile: s.reportFile ? { ...s.reportFile, sizeFormatted: formatBytes(s.reportFile.size) } : null,
        telemetryCount: s.telemetryCount,
        monitoringLogFiles: s.monitoringLogFiles.map(f => ({ ...f, sizeFormatted: formatBytes(f.size) })),
      })),
    });
  }

  async deleteSessionFootprint(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const userId = req.user?._id?.toString() || req.userPayload?.userId || 'unknown';

    const result = await storageService.deleteSessionFootprint(sessionId, userId);
    res.json({
      success: true,
      message: result.message,
      data: result,
    });
  }

  async deleteFiles(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { category, names } = req.body;
    const userId = req.user?._id?.toString() || req.userPayload?.userId || 'unknown';

    const validCategories: StorageCategory[] = ['reports', 'analysis', 'evidence', 'sandbox-logs', 'monitoring'];

    if (!validCategories.includes(category)) {
      res.status(400).json({
        success: false,
        message: 'Invalid category',
        errors: [{ code: 'INVALID_CATEGORY', message: `Category must be one of: ${validCategories.join(', ')}` }],
      });
      return;
    }

    if (!Array.isArray(names) || names.length === 0) {
      res.status(400).json({
        success: false,
        message: 'File names array is required',
        errors: [{ code: 'INVALID_NAMES', message: 'Provide a non-empty array of file names' }],
      });
      return;
    }

    const result = await storageService.deleteFiles(category, names, userId);
    res.json({
      success: true,
      message: result.message,
      data: result,
    });
  }

  async deleteEvidence(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user?._id?.toString() || req.userPayload?.userId || 'unknown';

    const result = await storageService.deleteEvidenceById(id, userId);
    res.json({
      success: true,
      message: result.message,
      data: result,
    });
  }

  async purgeCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { key } = req.params;
    const { confirm } = req.body;
    const userId = req.user?._id?.toString() || req.userPayload?.userId || 'unknown';

    const validCategories: StorageCategory[] = ['reports', 'analysis', 'evidence', 'sandbox-logs', 'monitoring'];

    if (!validCategories.includes(key as StorageCategory)) {
      res.status(400).json({
        success: false,
        message: 'Invalid category',
        errors: [{ code: 'INVALID_CATEGORY', message: `Category must be one of: ${validCategories.join(', ')}` }],
      });
      return;
    }

    if (confirm !== true && confirm !== 'true') {
      res.status(400).json({
        success: false,
        message: 'Confirmation required',
        errors: [{ code: 'CONFIRMATION_REQUIRED', message: 'Set confirm=true to proceed' }],
      });
      return;
    }

    const result = await storageService.purgeCategory(key as StorageCategory, userId);
    res.json({
      success: true,
      message: result.message,
      data: result,
    });
  }

  async purgeAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { confirm } = req.body;
    const userId = req.user?._id?.toString() || req.userPayload?.userId || 'unknown';

    if (confirm !== 'PURGE') {
      res.status(400).json({
        success: false,
        message: 'Invalid confirmation token',
        errors: [{ code: 'INVALID_CONFIRMATION', message: 'Must provide confirm: "PURGE"' }],
      });
      return;
    }

    const result = await storageService.purgeAllSessionData(userId, confirm);
    res.json({
      success: true,
      message: result.message,
      data: result,
    });
  }

  async getFileHash(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { key, filename } = req.params;
    const validCategories: StorageCategory[] = ['reports', 'analysis', 'evidence', 'sandbox-logs', 'monitoring'];

    if (!validCategories.includes(key as StorageCategory)) {
      res.status(400).json({
        success: false,
        message: 'Invalid category',
        errors: [{ code: 'INVALID_CATEGORY', message: `Category must be one of: ${validCategories.join(', ')}` }],
      });
      return;
    }

    const hash = await storageService.getFileHash(key as StorageCategory, filename);
    res.json({
      success: true,
      data: { filename, ...hash },
    });
  }
}

export const storageController = new StorageController();
export default storageController;