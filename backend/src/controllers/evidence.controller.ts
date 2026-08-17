/**
 * Evidence Controller
 * Handles evidence management endpoints
 */

import { Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { evidenceService } from '../services';
import { AuthenticatedRequest } from '../middleware';
import { ApiResponse, EvidenceType } from '../types';
import { config } from '../config';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = './uploads/temp';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxSize },
  fileFilter: (req, file, cb) => {
    const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();
    if (config.upload.allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

export class EvidenceController {
  /**
   * POST /api/v1/evidence/upload
   * Upload evidence file
   */
  uploadFile = upload.single('file');

  async upload(req: AuthenticatedRequest, res: Response): Promise<void> {
    const file = req.file;
    if (!file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
      return;
    }

    const evidence = await evidenceService.uploadEvidence({
      investigationId: req.body.investigationId,
      file,
      description: req.body.description,
      type: req.body.type as EvidenceType,
      simulatorHint: req.body.simulatorHint,
      collectedBy: req.user?.id,
      tags: req.body.tags ? JSON.parse(req.body.tags) : [],
    });

    const response: ApiResponse = {
      success: true,
      message: 'Evidence uploaded successfully',
      data: { evidence },
    };

    res.status(201).json(response);
  }

  /**
   * POST /api/v1/evidence/url
   * Register a URL as evidence (no file — fingerprint is the URL string)
   */
  async registerUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { investigationId, url, name, description } = req.body;

    if (!investigationId || !url) {
      res.status(400).json({
        success: false,
        message: 'investigationId and url are required',
      });
      return;
    }

    const evidence = await evidenceService.registerUrlEvidence({
      investigationId,
      url,
      name,
      description,
      collectedBy: req.user?.id,
      tags: req.body.tags ? JSON.parse(req.body.tags) : [],
    });

    const response: ApiResponse = {
      success: true,
      message: 'URL registered as evidence',
      data: { evidence },
    };

    res.status(201).json(response);
  }

  /**
   * GET /api/v1/evidence/investigation/:investigationId
   * Get evidence by investigation
   */
  async findByInvestigation(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { investigationId } = req.params;
    const { page = 1, limit = 20, type } = req.query as Record<string, any>;

    const result = await evidenceService.findByInvestigation(investigationId, {
      page: Number(page),
      limit: Math.min(Number(limit), 100),
      type: type as EvidenceType,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Evidence retrieved',
      data: result.evidence,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total: result.total,
        totalPages: result.totalPages,
      },
    };

    res.json(response);
  }

  /**
   * GET /api/v1/evidence
   * List all evidence with pagination, search, and type filters
   */
  async findAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { page = 1, limit = 20, search, type, status } = req.query as Record<string, any>;

    const result = await evidenceService.findAll({
      page: Number(page),
      limit: Math.min(Number(limit), 100),
      search: search as string,
      type: type as EvidenceType,
      status: status as string,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Evidence retrieved',
      data: result.evidence,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total: result.total,
        totalPages: result.totalPages,
      },
    };

    res.json(response);
  }

  /**
   * GET /api/v1/evidence/:id
   * Get evidence by ID
   */
  async findById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const evidence = await evidenceService.findById(req.params.id);

    const response: ApiResponse = {
      success: true,
      message: 'Evidence retrieved',
      data: { evidence },
    };

    res.json(response);
  }

  /**
   * POST /api/v1/evidence/:id/verify
   * Verify evidence integrity
   */
  async verifyIntegrity(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await evidenceService.verifyIntegrity(req.params.id);

    const response: ApiResponse = {
      success: true,
      message: result.verified ? 'Evidence verified' : 'Evidence verification failed',
      data: result,
    };

    res.json(response);
  }

  /**
   * POST /api/v1/evidence/:id/simulate-tamper
   * Simulate tampering with an evidence file (demo mode only)
   */
  async simulateTamper(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!config.demo.enabled) {
      res.status(403).json({
        success: false,
        message: 'Demo mode is disabled',
      });
      return;
    }

    const result = await evidenceService.simulateTamper(req.params.id);

    const response: ApiResponse = {
      success: true,
      message: 'Evidence tampering simulated',
      data: result,
    };

    res.json(response);
  }

  /**
   * POST /api/v1/evidence/:id/restore
   * Restore a tampered evidence file (demo mode only)
   */
  async restoreTamper(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!config.demo.enabled) {
      res.status(403).json({
        success: false,
        message: 'Demo mode is disabled',
      });
      return;
    }

    const result = await evidenceService.restoreTamper(req.params.id);

    const response: ApiResponse = {
      success: true,
      message: 'Evidence restored',
      data: result,
    };

    res.json(response);
  }

  /**
   * DELETE /api/v1/evidence/:id
   * Delete evidence
   */
  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    await evidenceService.delete(req.params.id);

    const response: ApiResponse = {
      success: true,
      message: 'Evidence deleted',
    };

    res.json(response);
  }
}

export const evidenceController = new EvidenceController();
export default evidenceController;