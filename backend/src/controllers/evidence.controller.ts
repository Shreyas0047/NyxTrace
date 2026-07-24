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
    const { page = 1, limit = 20, search, type } = req.query as Record<string, any>;

    const result = await evidenceService.findAll({
      page: Number(page),
      limit: Math.min(Number(limit), 100),
      search: search as string,
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