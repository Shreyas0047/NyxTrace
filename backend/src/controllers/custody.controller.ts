/**
 * Chain of Custody Controller
 * Handles chain-of-custody and evidence lineage endpoints
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware';
import { ApiResponse } from '../types';
import { chainOfCustodyService } from '../services/custody.service';
import { IntegrityStatus, CustodyEventType } from '../models/custody.model';

export class CustodyController {
  /**
   * GET /api/v1/custody/chain/:evidenceId
   * Get chain of custody visualization
   */
  async getChainOfCustody(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId } = req.params;

      const chain = await chainOfCustodyService.getChainVisualization(evidenceId);

      if (!chain) {
        res.status(404).json({
          success: false,
          message: 'Chain of custody not found',
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Chain of custody retrieved',
        data: { chain },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get chain of custody',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/custody/timeline/:evidenceId
   * Get full custody timeline
   */
  async getCustodyTimeline(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId } = req.params;

      const timeline = await chainOfCustodyService.getCustodyTimeline(evidenceId);

      const response: ApiResponse = {
        success: true,
        message: 'Custody timeline retrieved',
        data: { timeline },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get custody timeline',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/custody/event
   * Add custody event
   */
  async addCustodyEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId, eventType, details, investigationId } = req.body;

      if (!evidenceId || !eventType || !details) {
        res.status(400).json({
          success: false,
          message: 'Evidence ID, event type, and details are required',
        });
        return;
      }

      const chain = await chainOfCustodyService.addEvent({
        evidenceId,
        eventType,
        performedBy: req.user?.id || 'system',
        performedByName: req.user?.username || 'System',
        details,
        investigationId,
        integrityStatus: IntegrityStatus.PENDING_VERIFICATION,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Custody event added',
        data: { chain },
      };

      res.status(201).json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to add custody event',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/custody/verification-history/:evidenceId
   * Get verification history
   */
  async getVerificationHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId } = req.params;
      const { limit } = req.query;

      const history = await chainOfCustodyService.getVerificationHistory(
        evidenceId,
        limit ? parseInt(limit as string) : 100
      );

      const response: ApiResponse = {
        success: true,
        message: 'Verification history retrieved',
        data: { history },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get verification history',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/custody/transfer
   * Transfer custody
   */
  async transferCustody(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId, newHolderId, newHolderName } = req.body;

      if (!evidenceId || !newHolderId || !newHolderName) {
        res.status(400).json({
          success: false,
          message: 'Evidence ID, new holder ID, and new holder name are required',
        });
        return;
      }

      await chainOfCustodyService.transferCustody(
        evidenceId,
        newHolderId,
        newHolderName,
        req.user?.id || 'system',
        req.user?.username || 'System'
      );

      const response: ApiResponse = {
        success: true,
        message: 'Custody transferred',
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to transfer custody',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/custody/lineage-graph/:investigationId
   * Get evidence lineage graph
   */
  async getLineageGraph(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { investigationId } = req.params;

      const graph = await chainOfCustodyService.getEvidenceLineageGraph(investigationId);

      const response: ApiResponse = {
        success: true,
        message: 'Evidence lineage graph retrieved',
        data: graph,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get lineage graph',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/custody/integrity-stats
   * Get integrity statistics
   */
  async getIntegrityStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const stats = await chainOfCustodyService.getIntegrityStatistics();

      const response: ApiResponse = {
        success: true,
        message: 'Integrity statistics retrieved',
        data: { stats },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get integrity statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/custody/tamper-investigations
   * Get open tamper investigations
   */
  async getTamperInvestigations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const investigations = await chainOfCustodyService.getOpenTamperInvestigations();

      const response: ApiResponse = {
        success: true,
        message: 'Tamper investigations retrieved',
        data: { investigations },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get tamper investigations',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/custody/tamper-investigation
   * Create tamper investigation
   */
  async createTamperInvestigation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId, expectedHash, actualHash, severity } = req.body;

      if (!evidenceId || !expectedHash || !actualHash) {
        res.status(400).json({
          success: false,
          message: 'Evidence ID, expected hash, and actual hash are required',
        });
        return;
      }

      const investigation = await chainOfCustodyService.createTamperInvestigation(
        evidenceId,
        expectedHash,
        actualHash,
        severity || 'high'
      );

      const response: ApiResponse = {
        success: true,
        message: 'Tamper investigation created',
        data: { investigation },
      };

      res.status(201).json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create tamper investigation',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/custody/tamper-investigation/:investigationId/update
   * Update tamper investigation
   */
  async updateTamperInvestigation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { investigationId } = req.params;
      const updates = req.body;

      await chainOfCustodyService.updateTamperInvestigation(investigationId, updates);

      const response: ApiResponse = {
        success: true,
        message: 'Tamper investigation updated',
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update tamper investigation',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/custody/report
   * Generate verification report
   */
  async generateReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { investigationId, evidenceIds, reportType } = req.body;

      if (!evidenceIds || !reportType) {
        res.status(400).json({
          success: false,
          message: 'Evidence IDs and report type are required',
        });
        return;
      }

      const report = await chainOfCustodyService.generateVerificationReport(
        investigationId,
        evidenceIds,
        reportType,
        req.user?.id || 'system',
        req.user?.username || 'System'
      );

      const response: ApiResponse = {
        success: true,
        message: 'Verification report generated',
        data: { report },
      };

      res.status(201).json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate report',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/custody/report/:reportId/export
   * Export verification report
   */
  async exportReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const { exportFormat } = req.body;

      const exported = await chainOfCustodyService.exportReport(
        reportId,
        exportFormat || 'json',
        req.user?.id || 'system'
      );

      const response: ApiResponse = {
        success: true,
        message: 'Report exported',
        data: {
          report: exported.report,
          pdfBase64: exported.pdfBase64,
          pdfFileName: exported.pdfFileName,
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to export report',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const custodyController = new CustodyController();
export default custodyController;
