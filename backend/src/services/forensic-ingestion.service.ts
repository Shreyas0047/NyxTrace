/**
 * Forensic Report Ingestion Service
 * Handles forensic report uploads from sandbox agents
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Report, Investigation, SandboxSession, Alert, AlertSeverity, AlertType, AlertSource, ReportType, ReportSeverity } from '../models';
import { ReportSeverity as ReportSeverityType } from '../types';
import { NotFoundError, ValidationError } from '../middleware';
import { evidenceValidationService, ValidationResult } from './evidence-validation.service';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

export interface IngestedReport {
  report: any;
  metadata: Record<string, any>;
  warnings: string[];
}

export interface ForensicReportData {
  investigationId?: string;
  sessionId?: string;
  caseNumber?: string;
  reportType: string;
  title: string;
  summary: string;
  severity?: string;
  findings?: Array<{
    category: string;
    title: string;
    description: string;
    severity: string;
    indicators?: string[];
    mitreTactics?: string[];
    mitreTechniques?: string[];
    recommendations?: string[];
  }>;
  iocIndicators?: Array<{
    type: string;
    value: string;
    description?: string;
  }>;
  timeline?: Array<{
    timestamp: string;
    event: string;
    description: string;
  }>;
  riskScore?: number;
  aiAnalysis?: {
    summary?: string;
    threatClassification?: {
      category: string;
      family: string;
      confidence: number;
    };
    recommendations?: string[];
  };
  events?: Array<any>;
  metadata?: Record<string, any>;
}

export class ForensicIngestionService {
  /**
   * Ingest forensic report from sandbox
   */
  async ingestForensicReport(
    payload: {
      investigationId?: string;
      sessionId?: string;
      reportType: string;
      reportData: ForensicReportData;
      uploadedBy?: string;
    },
    file?: Express.Multer.File
  ): Promise<IngestedReport> {
    // Validate the report payload
    const validation = evidenceValidationService.validateForensicReport({
      investigationId: payload.investigationId,
      sessionId: payload.sessionId,
      reportType: payload.reportType,
      reportData: payload.reportData,
    });

    if (!validation.valid) {
      throw new ValidationError(`Invalid forensic report: ${validation.errors.join(', ')}`, validation.errors.map(e => ({ field: 'report', message: e })));
    }

    // Generate report ID
    const reportId = this.generateReportId();

    // Resolve investigation
    let investigation = null;
    if (payload.investigationId) {
      investigation = await Investigation.findById(payload.investigationId);
    } else if (payload.reportData.caseNumber) {
      investigation = await Investigation.findOne({ caseNumber: payload.reportData.caseNumber });
    }

    // Create report record
    const report = await Report.create({
      reportId,
      investigationId: investigation?._id || undefined,
      investigationCaseNumber: investigation?.caseNumber,
      title: payload.reportData.title || `Forensic Report - ${payload.reportType}`,
      summary: payload.reportData.summary || 'Automated forensic analysis report',
      type: this.mapReportType(payload.reportType),
      status: 'draft',
      severity: this.mapSeverity(payload.reportData.severity || payload.reportData.riskScore),

      findings: payload.reportData.findings?.map((f, idx) => ({
        id: uuidv4(),
        category: f.category,
        severity: f.severity,
        title: f.title,
        description: f.description,
        timestamp: new Date(),
        indicators: f.indicators || [],
        evidence: [] as string[],
        recommendations: f.recommendations || [],
        mitreTactics: f.mitreTactics,
        mitreTechniques: f.mitreTechniques,
      })),

      iocIndicators: payload.reportData.iocIndicators?.map(ioc => ({
        type: ioc.type,
        value: ioc.value,
        description: ioc.description,
        context: 'imported_from_sandbox',
      })),

      timeline: payload.reportData.timeline?.map(entry => ({
        timestamp: new Date(entry.timestamp),
        event: entry.event,
        description: entry.description,
        source: 'sandbox_sync',
      })),

      aiAnalysisCompleted: !!payload.reportData.aiAnalysis,
      aiAnalysis: payload.reportData.aiAnalysis ? {
        summary: payload.reportData.aiAnalysis.summary,
        threatClassification: payload.reportData.aiAnalysis.threatClassification,
        behavioralIndicators: [],
        recommendations: payload.reportData.aiAnalysis.recommendations || [],
        similarThreats: [],
        riskScore: payload.reportData.riskScore || 0,
      } : undefined,

      generatedAt: new Date(),
      generatedBy: payload.uploadedBy || 'system',
      tags: this.generateTags(payload.reportData, payload.reportType),

      // Link to sandbox session if provided
      sandboxSessionId: payload.sessionId
        ? (await this.findOrCreateSession(payload.sessionId))?._id
        : undefined,

      customFields: {
        originalReportType: payload.reportType,
        ingestedAt: new Date(),
        validationWarnings: validation.warnings,
        metadata: payload.reportData.metadata,
      },
    });

    // Update investigation if linked
    if (investigation) {
      investigation.reportIds.push(report._id);
      investigation.reportCount = (investigation.reportCount || 0) + 1;

      // Add timeline entry
      investigation.timeline.push({
        timestamp: new Date(),
        action: 'report_generated',
        userId: payload.uploadedBy || 'system',
        userName: 'System',
        details: `Forensic report "${report.title}" generated from sandbox`,
      });

      await investigation.save();
    }

    // Handle file attachment if provided
    if (file) {
      await this.attachFileToReport(report._id.toString(), file, payload.uploadedBy);
    }

    return {
      report,
      metadata: {
        reportId,
        linkedInvestigation: investigation?._id,
        linkedSession: payload.sessionId,
        validationWarnings: validation.warnings,
        reportType: payload.reportType,
      },
      warnings: validation.warnings,
    };
  }

  /**
   * Ingest execution summary from sandbox
   */
  async ingestExecutionSummary(
    sessionId: string,
    summary: {
      simulatorId: string;
      simulatorName: string;
      startTime: string;
      endTime: string;
      exitCode: number;
      duration: number;
      eventsCollected: number;
      findings: Array<{
        type: string;
        severity: string;
        description: string;
        details?: Record<string, any>;
      }>;
      iocIndicators?: Array<{ type: string; value: string }>;
      screenshots?: string[];
      artifacts?: string[];
    },
    uploadedBy?: string
  ): Promise<any> {
    // Update sandbox session with execution summary
    const { SandboxSession } = await import('../models');
    const session = await SandboxSession.findOne({ sessionId });

    if (!session) {
      throw new NotFoundError('Sandbox session');
    }

    // Store execution summary
    const summaryData = {
      simulatorId: summary.simulatorId,
      simulatorName: summary.simulatorName,
      startTime: new Date(summary.startTime),
      endTime: new Date(summary.endTime),
      exitCode: summary.exitCode,
      duration: summary.duration,
      eventsCollected: summary.eventsCollected,
      findings: summary.findings,
      iocIndicators: summary.iocIndicators || [],
      artifacts: summary.artifacts || [],
      syncedAt: new Date(),
    };

    // Update session
    session.executionSummary = summaryData as any;
    session.syncedAt = new Date();
    await session.save();

    // Auto-create report for high-severity findings
    const highSeverityFindings = summary.findings?.filter(
      f => f.severity === 'critical' || f.severity === 'high'
    );

    if (highSeverityFindings && highSeverityFindings.length > 0) {
      await this.createAlertFromFindings(session, highSeverityFindings);
    }

    return {
      sessionId,
      summaryIngested: true,
      findingsCount: summary.findings?.length || 0,
      iocCount: summary.iocIndicators?.length || 0,
    };
  }

  /**
   * Attach file to existing report
   */
  async attachFileToReport(
    reportId: string,
    file: Express.Multer.File,
    uploadedBy?: string
  ): Promise<void> {
    const report = await Report.findById(reportId);
    if (!report) {
      throw new NotFoundError('Report');
    }

    // Generate safe filename
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    const safeFilename = `${reportId}-${fileId}${ext}`;
    const destPath = path.join(config.evidence.reportsPath, safeFilename);

    // Move file
    fs.renameSync(file.path, destPath);

    // Add to export formats
    report.exportFormats.push({
      format: ext.replace('.', '').toUpperCase(),
      path: destPath,
      generatedAt: new Date(),
    });

    await report.save();
  }

  /**
   * Generate report ID
   */
  private generateReportId(): string {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = uuidv4().slice(0, 8).toUpperCase();
    return `FR-${timestamp}-${random}`;
  }

  /**
   * Map report type to enum
   */
  private mapReportType(reportType: string): ReportType {
    const typeMap: Record<string, ReportType> = {
      execution_summary: ReportType.SANDBOX,
      process_analysis: ReportType.TECHNICAL,
      file_analysis: ReportType.EVIDENCE,
      registry_analysis: ReportType.TECHNICAL,
      network_analysis: ReportType.TECHNICAL,
      behavioral_analysis: ReportType.TECHNICAL,
      threat_classification: ReportType.MALWARE,
      incident_report: ReportType.INCIDENT,
    };

    return typeMap[reportType] || ReportType.TECHNICAL;
  }

  /**
   * Map severity to enum
   */
  private mapSeverity(severity?: string | number): ReportSeverity {
    if (typeof severity === 'number') {
      if (severity >= 80) return ReportSeverity.CRITICAL;
      if (severity >= 60) return ReportSeverity.HIGH;
      if (severity >= 40) return ReportSeverity.MEDIUM;
      if (severity >= 20) return ReportSeverity.LOW;
      return ReportSeverity.INFORMATIONAL;
    }

    const severityMap: Record<string, ReportSeverity> = {
      critical: ReportSeverity.CRITICAL,
      high: ReportSeverity.HIGH,
      medium: ReportSeverity.MEDIUM,
      low: ReportSeverity.LOW,
      informational: ReportSeverity.INFORMATIONAL,
    };

    return severityMap[severity?.toLowerCase() || ''] || ReportSeverity.INFORMATIONAL;
  }

  /**
   * Generate tags for report
   */
  private generateTags(data: ForensicReportData, reportType: string): string[] {
    const tags: string[] = ['sandbox', 'ingested'];

    // Add report type tag
    tags.push(reportType.replace('_', '-'));

    // Add category tags from findings
    if (data.findings) {
      const categories = [...new Set(data.findings.map(f => f.category))];
      tags.push(...categories.slice(0, 3));
    }

    // Add IOC indicator tags
    if (data.iocIndicators && data.iocIndicators.length > 0) {
      const types = [...new Set(data.iocIndicators.map(i => i.type))];
      tags.push(...types.map(t => `ioc-${t}`));
    }

    // Add severity tag
    if (data.riskScore !== undefined) {
      if (data.riskScore >= 80) tags.push('critical-severity');
      else if (data.riskScore >= 60) tags.push('high-severity');
    }

    return tags;
  }

  /**
   * Find or create sandbox session
   */
  private async findOrCreateSession(sessionId: string): Promise<any> {
    let session = await SandboxSession.findOne({ sessionId });

    if (!session) {
      // Create placeholder session
      session = await SandboxSession.create({
        sessionId,
        vmName: 'imported',
        simulatorId: 'unknown',
        simulatorName: 'Imported Session',
        status: 'completed' as any,
      });
    }

    return session;
  }

  /**
   * Create alert from high-severity findings
   */
  private async createAlertFromFindings(
    session: any,
    findings: Array<{ type: string; severity: string; description: string; details?: Record<string, any> }>
  ): Promise<void> {
    for (const finding of findings) {
      await Alert.create({
        alertId: `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        title: `Sandbox Detection: ${finding.type}`,
        description: finding.description,
        type: AlertType.SANDBOX,
        severity: finding.severity === 'critical'
          ? AlertSeverity.CRITICAL
          : AlertSeverity.HIGH,
        source: AlertSource.SANDBOX,
        status: 'new',
        relatedSandboxSessionId: session._id,
        tags: ['sandbox', 'automated', finding.type],
        metadata: {
          findingType: finding.type,
          sessionId: session.sessionId,
          autoGenerated: true,
          details: finding.details,
        },
      });
    }
  }
}

export const forensicIngestionService = new ForensicIngestionService();
export default forensicIngestionService;