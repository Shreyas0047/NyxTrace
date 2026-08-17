import { Response } from 'express';
import { analysisService } from '../services/analysis.service';
import { AuthenticatedRequest } from '../middleware';
import { ApiResponse } from '../types';

export class AnalysisController {
  async analyzeDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No file uploaded', errors: [{ code: 'NO_FILE', message: 'A PDF or DOCX file is required' }] });
        return;
      }

      const result = await analysisService.analyzeDocument(req.file.path, req.file.originalname, {
        investigationId: req.body.investigationId,
        evidenceId: req.body.evidenceId,
      });
      const response: ApiResponse = {
        success: true,
        message: 'Document analysis complete',
        data: result,
      };
      res.json(response);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Document analysis failed',
        errors: [{ code: error.code || 'ANALYSIS_ERROR', message: error.message }],
      });
    }
  }

  async analyzeUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { url } = req.body;
      if (!url) {
        res.status(400).json({ success: false, message: 'URL is required', errors: [{ code: 'MISSING_URL', message: 'url field is required' }] });
        return;
      }

      try {
        new URL(url.startsWith('http') ? url : `http://${url}`);
      } catch {
        res.status(400).json({ success: false, message: 'Invalid URL format', errors: [{ code: 'INVALID_URL', message: 'The provided URL is not valid' }] });
        return;
      }

      const result = await analysisService.analyzeUrl(url, {
        investigationId: req.body.investigationId,
        evidenceId: req.body.evidenceId,
      });
      const response: ApiResponse = {
        success: true,
        message: 'URL analysis complete',
        data: result,
      };
      res.json(response);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'URL analysis failed',
        errors: [{ code: error.code || 'ANALYSIS_ERROR', message: error.message }],
      });
    }
  }

  async getAnalysisById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await analysisService.getAnalysisById(req.params.id);
      const response: ApiResponse = { success: true, message: 'Analysis retrieved', data: result };
      res.json(response);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to retrieve analysis',
        errors: [{ code: error.code || 'FETCH_ERROR', message: error.message }],
      });
    }
  }

  async getAnalysisHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const type = req.query.type as string;
      const investigationId = req.query.investigationId as string;

      const result = await analysisService.getAnalysisHistory(page, limit, type, investigationId);
      const response: ApiResponse = {
        success: true,
        message: 'Analysis history retrieved',
        data: result.items,
        meta: { page: result.page, limit, total: result.total, totalPages: result.totalPages },
      };
      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analysis history',
        errors: [{ code: 'FETCH_ERROR', message: error.message }],
      });
    }
  }
}

export const analysisController = new AnalysisController();
export default analysisController;
