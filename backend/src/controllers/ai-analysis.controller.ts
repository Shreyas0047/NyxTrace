/**
 * AI Analysis Controller
 * Handles AI-powered forensic analysis endpoints
 */

import { Response } from 'express';
import { aiAnalysisService } from '../services';
import { AuthenticatedRequest } from '../middleware';
import { ApiResponse } from '../types';

export class AIController {
  /**
   * POST /api/v1/ai/analyze/telemetry
   * Analyze telemetry from sandbox execution
   */
  async analyzeTelemetry(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { sessionId, events, metadata } = req.body;

    if (!sessionId || !events || !Array.isArray(events)) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: sessionId, events (array)',
      } as ApiResponse);
      return;
    }

    try {
      const result = await aiAnalysisService.analyzeTelemetry({
        sessionId,
        investigationId: req.body.investigationId,
        events,
        metadata,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Telemetry analysis completed',
        data: result,
      };

      res.json(response);
    } catch (err) {
      const error = err as Error;
      res.status(500).json({
        success: false,
        message: error.message || 'Analysis failed',
      } as ApiResponse);
    }
  }

  /**
   * POST /api/v1/ai/enrich/alert
   * Enrich alert with AI analysis
   */
  async enrichAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { alertId, title, description, type, severity, iocIndicators } = req.body;

    if (!alertId || !title) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: alertId, title',
      } as ApiResponse);
      return;
    }

    try {
      const result = await aiAnalysisService.enrichAlert({
        alertId,
        title,
        description,
        type,
        severity,
        iocIndicators,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Alert enriched with AI analysis',
        data: result,
      };

      res.json(response);
    } catch (err) {
      const error = err as Error;
      res.status(500).json({
        success: false,
        message: error.message || 'Alert enrichment failed',
      } as ApiResponse);
    }
  }

  /**
   * POST /api/v1/ai/summarize/investigation
   * Generate AI investigation summary
   */
  async summarizeInvestigation(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { investigationId, title, description, caseNumber, evidence, reports, alerts, timeline } = req.body;

    if (!investigationId) {
      res.status(400).json({
        success: false,
        message: 'Missing required field: investigationId',
      } as ApiResponse);
      return;
    }

    try {
      const result = await aiAnalysisService.generateInvestigationSummary({
        investigationId,
        title: title || '',
        description: description || '',
        caseNumber: caseNumber || '',
        evidence: evidence || [],
        reports: reports || [],
        alerts: alerts || [],
        timeline: timeline || [],
      });

      const response: ApiResponse = {
        success: true,
        message: 'Investigation summary generated',
        data: result,
      };

      res.json(response);
    } catch (err) {
      const error = err as Error;
      res.status(500).json({
        success: false,
        message: error.message || 'Summary generation failed',
      } as ApiResponse);
    }
  }

  /**
   * POST /api/v1/ai/analyze/report
   * Analyze forensic report
   */
  async analyzeReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { reportData, investigationId } = req.body;

    if (!reportData) {
      res.status(400).json({
        success: false,
        message: 'Missing required field: reportData',
      } as ApiResponse);
      return;
    }

    try {
      const result = await aiAnalysisService.analyzeReport(reportData, investigationId);

      const response: ApiResponse = {
        success: true,
        message: 'Report analysis completed',
        data: result,
      };

      res.json(response);
    } catch (err) {
      const error = err as Error;
      res.status(500).json({
        success: false,
        message: error.message || 'Report analysis failed',
      } as ApiResponse);
    }
  }

  /**
   * GET /api/v1/ai/health
   * Check AI service health
   */
  async checkHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const healthy = await aiAnalysisService.checkHealth();

      const response: ApiResponse = {
        success: healthy,
        message: healthy ? 'AI service operational' : 'AI service unavailable',
        data: {
          status: healthy ? 'operational' : 'unavailable',
          service: 'forensic-ai-analysis-engine',
        },
      };

      res.status(healthy ? 200 : 503).json(response);
    } catch (err) {
      res.status(503).json({
        success: false,
        message: 'AI service unavailable',
        data: { status: 'unavailable' },
      } as ApiResponse);
    }
  }
}

export const aiController = new AIController();
export default aiController;