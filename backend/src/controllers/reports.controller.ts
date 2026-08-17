/**
 * Reports Controller
 * Handles forensic report endpoints
 */

import { Response } from 'express';
import { reportsService } from '../services';
import { AuthenticatedRequest } from '../middleware';
import type { ApiResponse } from '../types';

export class ReportsController {
  async findAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { page = 1, limit = 20, simulator, severity, dateFrom, dateTo, search, investigationId } = req.query as Record<string, string>;

    const result = await reportsService.getReports({
      page: Number(page),
      limit: Number(limit),
      simulator,
      severity,
      dateFrom,
      dateTo,
      search,
      investigationId,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Reports retrieved',
      data: result.reports,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total: result.total,
        totalPages: Math.ceil(result.total / Number(limit)),
      },
    };

    res.json(response);
  }

  async findById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const report = await reportsService.getReportById(req.params.id);

    if (!report) {
      res.status(404).json({
        success: false,
        message: 'Report not found',
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Report retrieved',
      data: report,
    };

    res.json(response);
  }

  async exportReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { format = 'json' } = req.query as Record<string, string>;
    const result = await reportsService.exportReport(req.params.id, format as 'json' | 'text' | 'pdf');

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Report not found',
      });
      return;
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  }
}

export const reportsController = new ReportsController();
export default reportsController;