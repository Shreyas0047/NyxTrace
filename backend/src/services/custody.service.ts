/**
 * Chain of Custody Service
 * Immutable evidence tracking and custody chain management
 */

import { ChainOfCustody, EvidenceLineage, VerificationHistory, TamperInvestigation, VerificationReport, IntegrityStatus, CustodyEventType } from '../models/custody.model';
import { Evidence } from '../models';
import { evidenceHashingService } from '../blockchain';
import { BlockchainVerification } from '../blockchain/models/blockchain.model';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export interface CustodyEventInput {
  evidenceId: string;
  eventType: CustodyEventType;
  performedBy: string;
  performedByName: string;
  details: string;
  investigationId?: string;
  transactionHash?: string;
  blockNumber?: number;
  integrityStatus?: IntegrityStatus;
  metadata?: Record<string, any>;
}

export interface ChainVisualization {
  evidenceId: string;
  chainId: string;
  events: Array<{
    timestamp: Date;
    eventType: string;
    details: string;
    performedBy: string;
    integrityStatus?: string;
    transactionHash?: string;
    blockNumber?: number;
  }>;
  integrityStatus: string;
  blockchainVerified: boolean;
}

export class ChainOfCustodyService {
  /**
   * Initialize chain of custody for new evidence
   */
  async initializeChain(evidenceId: string, userId: string, userName: string): Promise<any> {
    const chainId = `COC-${uuidv4().substring(0, 8).toUpperCase()}`;
    const genesisHash = this.generateHash(`${evidenceId}:${chainId}:genesis:${Date.now()}`);

    const chain = await ChainOfCustody.create({
      evidenceId,
      chainId,
      currentHolder: userId,
      currentHolderName: userName,
      custodyStatus: 'active',
      integrityStatus: IntegrityStatus.PENDING_VERIFICATION,
      events: [],
      chainHash: genesisHash,
      genesisHash,
    });

    // Add genesis event
    await this.addEvent({
      evidenceId,
      eventType: CustodyEventType.EVIDENCE_CREATED,
      performedBy: userId,
      performedByName: userName,
      details: 'Evidence chain of custody initialized',
    });

    // Create lineage record
    await EvidenceLineage.create({
      evidenceId,
      lineageType: 'original',
    });

    return chain;
  }

  /**
   * Add custody event
   */
  async addEvent(input: CustodyEventInput): Promise<any> {
    const { evidenceId, eventType, performedBy, performedByName, details, investigationId, transactionHash, blockNumber, integrityStatus, metadata } = input;

    // Get existing chain
    let chain = await ChainOfCustody.findOne({ evidenceId });

    if (!chain) {
      // Initialize if not exists
      chain = await this.initializeChain(evidenceId, performedBy, performedByName);
    }

    // Get previous event hash
    const previousHash = chain.chainHash;

    // Create event
    const eventHash = this.generateHash(
      `${evidenceId}:${eventType}:${performedBy}:${Date.now()}:${previousHash}`
    );

    const event = {
      eventId: uuidv4(),
      evidenceId,
      eventType,
      timestamp: new Date(),
      performedBy,
      performedByName,
      details,
      investigationId,
      transactionHash,
      blockNumber,
      integrityStatus,
      previousEventHash: previousHash,
      currentEventHash: eventHash,
      metadata,
    };

    // Atomic update — prevents race conditions on concurrent evidence uploads
    const updateFields: Record<string, any> = {
      $push: { events: event },
      $inc: { eventCount: 1 },
      $set: {
        lastEventAt: new Date(),
        chainHash: eventHash,
      },
    };

    if (eventType === CustodyEventType.CUSTODY_TRANSFERRED) {
      updateFields.$set.currentHolder = performedBy;
      updateFields.$set.currentHolderName = performedByName;
    }
    if (integrityStatus) {
      updateFields.$set.integrityStatus = integrityStatus;
      updateFields.$set.lastIntegrityCheck = new Date();
    }
    if (transactionHash && blockNumber) {
      updateFields.$set.blockchainVerified = true;
      updateFields.$set.blockchainTxHash = transactionHash;
      updateFields.$set.blockchainBlockNumber = blockNumber;
    }

    chain = await ChainOfCustody.findOneAndUpdate(
      { evidenceId },
      updateFields,
      { new: true }
    );

    // Add verification to history
    if (eventType === CustodyEventType.VERIFICATION_COMPLETED || eventType === CustodyEventType.VERIFICATION_FAILED) {
      await this.recordVerification({
        evidenceId,
        verificationType: 'integrity',
        status: eventType === CustodyEventType.VERIFICATION_COMPLETED ? 'success' : 'failed',
        performedBy,
        performedByName,
        details,
      });
    }

    return chain;
  }

  /**
   * Record verification event
   */
  async recordVerification(input: {
    evidenceId: string;
    verificationType: string;
    status: string;
    performedBy?: string;
    performedByName?: string;
    expectedHash?: string;
    actualHash?: string;
    transactionHash?: string;
    blockNumber?: number;
    verificationTime?: number;
    details?: string;
  }): Promise<any> {
    const verification = await VerificationHistory.create({
      verificationId: uuidv4(),
      evidenceId: input.evidenceId,
      verificationType: input.verificationType,
      timestamp: new Date(),
      performedBy: input.performedBy,
      performedByName: input.performedByName,
      status: input.status,
      expectedHash: input.expectedHash,
      actualHash: input.actualHash,
      hashMatch: input.expectedHash && input.actualHash
        ? input.expectedHash === input.actualHash
        : undefined,
      transactionHash: input.transactionHash,
      blockNumber: input.blockNumber,
      verificationTime: input.verificationTime,
      details: input.details,
    });

    return verification;
  }

  /**
   * Get chain of custody visualization
   */
  async getChainVisualization(evidenceId: string): Promise<ChainVisualization | null> {
    const chain = await ChainOfCustody.findOne({ evidenceId });

    if (!chain) return null;

    return {
      evidenceId: String(chain.evidenceId),
      chainId: chain.chainId,
      events: chain.events.map(e => ({
        timestamp: e.timestamp,
        eventType: e.eventType,
        details: e.details,
        performedBy: e.performedByName,
        integrityStatus: e.integrityStatus,
        transactionHash: e.transactionHash,
        blockNumber: e.blockNumber,
      })),
      integrityStatus: chain.integrityStatus,
      blockchainVerified: chain.blockchainVerified,
    };
  }

  /**
   * Get full custody timeline
   */
  async getCustodyTimeline(evidenceId: string): Promise<any> {
    const chain = await ChainOfCustody.findOne({ evidenceId })
      .populate('currentHolder', 'username email')
      .populate('events.performedBy', 'username email');

    return chain;
  }

  /**
   * Link evidence to investigation
   */
  async linkToInvestigation(evidenceId: string, investigationId: string, userId: string, userName: string): Promise<void> {
    await this.addEvent({
      evidenceId,
      eventType: CustodyEventType.INVESTIGATION_LINKED,
      performedBy: userId,
      performedByName: userName,
      details: `Evidence linked to investigation ${investigationId}`,
      investigationId,
      integrityStatus: IntegrityStatus.SYNCING,
    });
  }

  /**
   * Transfer custody
   */
  async transferCustody(evidenceId: string, newHolderId: string, newHolderName: string, transferrerId: string, transferrerName: string): Promise<void> {
    await this.addEvent({
      evidenceId,
      eventType: CustodyEventType.CUSTODY_TRANSFERRED,
      performedBy: transferrerId,
      performedByName: transferrerName,
      details: `Custody transferred to ${newHolderName}`,
      integrityStatus: IntegrityStatus.PENDING_VERIFICATION,
    });

    const chain = await ChainOfCustody.findOne({ evidenceId });
    if (chain) {
      chain.currentHolder = newHolderId as any;
      chain.currentHolderName = newHolderName;
      await chain.save();
    }
  }

  /**
   * Get verification history
   */
  async getVerificationHistory(evidenceId: string, limit: number = 100): Promise<any[]> {
    return await VerificationHistory.find({ evidenceId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Create tamper investigation
   */
  async createTamperInvestigation(evidenceId: string, expectedHash: string, actualHash: string, severity: 'low' | 'medium' | 'high' | 'critical'): Promise<any> {
    const investigation = await TamperInvestigation.create({
      investigationId: uuidv4(),
      evidenceId,
      severity,
      expectedHash,
      actualHash,
      status: 'open',
      driftAnalysis: {
        firstDetectedAt: new Date(),
        lastConfirmedAt: new Date(),
        driftCount: 1,
      },
    });

    await this.addEvent({
      evidenceId,
      eventType: CustodyEventType.TAMPER_DETECTED,
      performedBy: 'system',
      performedByName: 'System',
      details: `Tamper suspected: hash mismatch detected`,
      integrityStatus: IntegrityStatus.TAMPER_SUSPECTED,
    });

    return investigation;
  }

  /**
   * Update tamper investigation
   */
  async updateTamperInvestigation(investigationId: string, updates: Record<string, any>): Promise<void> {
    const investigation = await TamperInvestigation.findOne({ investigationId });

    if (!investigation) {
      throw new Error('Tamper investigation not found');
    }

    Object.assign(investigation, updates);
    await investigation.save();
  }

  /**
   * Add event to tamper investigation
   */
  async addTamperInvestigationEvent(investigationId: string, action: string, performedBy: string, notes?: string): Promise<void> {
    const investigation = await TamperInvestigation.findOne({ investigationId });

    if (!investigation) {
      throw new Error('Tamper investigation not found');
    }

    investigation.events.push({
      timestamp: new Date(),
      action,
      performedBy,
      notes,
    });

    investigation.driftAnalysis.driftCount++;
    investigation.driftAnalysis.lastConfirmedAt = new Date();

    await investigation.save();
  }

  /**
   * Get open tamper investigations
   */
  async getOpenTamperInvestigations(): Promise<any[]> {
    return await TamperInvestigation.find({
      status: { $in: ['open', 'investigating'] },
    })
      .sort({ detectedAt: -1 })
      .lean();
  }

  /**
   * Generate verification report
   */
  async generateVerificationReport(
    investigationId: string | undefined,
    evidenceIds: string[],
    reportType: string,
    userId: string,
    userName: string
  ): Promise<any> {
    const reportId = `RPT-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Gather evidence details
    const evidenceDetails = [];
    let resolvedInvestigationId = investigationId;
    let verifiedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    let tamperCount = 0;

    for (const evidenceId of evidenceIds) {
      const evidence = await this.resolveEvidence(evidenceId);
      const chain = await ChainOfCustody.findOne({ evidenceId });
      const verification = await BlockchainVerification.findOne({ evidenceId });

      if (!resolvedInvestigationId && evidence?.investigationId) {
        resolvedInvestigationId = evidence.investigationId;
      }

      if (evidence) {
        let integrityStatus = 'unknown';
        if (chain) integrityStatus = chain.integrityStatus;
        else if (verification) integrityStatus = verification.status;

        if (integrityStatus === 'verified' || integrityStatus === 'intact') verifiedCount++;
        else if (integrityStatus === 'failed' || integrityStatus === 'modified') failedCount++;
        else if (integrityStatus === 'tamper_suspected' || integrityStatus === 'integrity_mismatch') tamperCount++;
        else pendingCount++;

        evidenceDetails.push({
          evidenceId: evidence.evidenceId || evidence._id.toString(),
          fileName: evidence.metadata?.fileName || evidence.name,
          sha256Hash: verification?.fingerprint || 'N/A',
          integrityStatus,
          blockchainVerified: chain?.blockchainVerified || false,
          lastVerifiedAt: verification?.verifiedAt || null,
        });
      }
    }

    // Gather custody timelines
    const custodyTimeline = [];
    for (const evidenceId of evidenceIds) {
      const chain = await ChainOfCustody.findOne({ evidenceId });
      if (chain) {
        custodyTimeline.push({
          evidenceId,
          events: chain.events,
        });
      }
    }

    // Generate report content
    const report = await VerificationReport.create({
      reportId,
      investigationId: resolvedInvestigationId,
      evidenceIds,
      reportType,
      generatedAt: new Date(),
      generatedBy: userId,
      generatedByName: userName,
      summary: {
        totalEvidence: evidenceIds.length,
        verifiedEvidence: verifiedCount,
        failedEvidence: failedCount,
        pendingEvidence: pendingCount,
        tamperDetected: tamperCount,
      },
      content: {
        evidenceDetails,
        custodyTimeline,
        tamperAlerts: [],
        blockchainReferences: [],
      },
      reportHash: this.generateHash(JSON.stringify({ reportId, evidenceIds, timestamp: Date.now() })),
    });

    return report;
  }

  /**
   * Export report
   * Returns PDF bytes (base64) when exportFormat is 'pdf', otherwise the report record.
   */
  async exportReport(reportId: string, exportFormat: string, userId: string): Promise<{
    report: any;
    pdfBase64?: string;
    pdfFileName?: string;
  }> {
    const report = await VerificationReport.findOne({ reportId });

    if (!report) {
      throw new Error('Report not found');
    }

    report.exportedAt = new Date();
    report.exportedBy = userId;
    report.exportFormat = exportFormat;
    await report.save();

    const result: { report: any; pdfBase64?: string; pdfFileName?: string } = { report };

    if (exportFormat === 'pdf') {
      const pdfBuffer = await this.generateReportPdf(report);
      result.pdfBase64 = pdfBuffer.toString('base64');
      result.pdfFileName = `${reportId}.pdf`;
    }

    return result;
  }

  /**
   * Build a court-ready PDF certification document for a verification report.
   */
  private async generateReportPdf(report: any): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true, info: { Title: `NyxTrace ${report.reportId}`, Author: 'NyxTrace' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const width = doc.page.width - 100;
    const fmtDate = (d: any): string => d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'N/A';

    // ── Header ─────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#0b1220').text('NyxTrace', { continued: false });
    doc.font('Helvetica').fontSize(11).fillColor('#334155').text('Chain of Custody Verification Report');
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(50 + width, doc.y).strokeColor('#94a3b8').lineWidth(1).stroke();
    doc.moveDown(0.6);

    // ── Metadata block ─────────────────────────────────────
    const metaRows: Array<[string, string]> = [
      ['Report ID', report.reportId || 'N/A'],
      ['Report Type', report.reportType || 'N/A'],
      ['Generated At', fmtDate(report.generatedAt)],
      ['Generated By', report.generatedByName || String(report.generatedBy || 'N/A')],
      ['Evidence Items', String((report.evidenceIds || []).length)],
      ['Report Hash', report.reportHash || 'N/A'],
    ];
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0b1220').text('REPORT METADATA');
    doc.moveDown(0.25);
    for (const [label, value] of metaRows) {
      doc.font('Helvetica').fontSize(9).fillColor('#334155');
      doc.text(label, 50, doc.y, { width: 130, continued: true, lineBreak: false });
      doc.font(label === 'Report Hash' ? 'Courier' : 'Helvetica').fontSize(8.5).fillColor('#0b1220')
        .text(label === 'Report Hash' ? (value || '').slice(0, 64) : value, { width: width - 130 });
    }
    doc.moveDown(0.7);

    // ── Summary ────────────────────────────────────────────
    const summary = report.summary || {};
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0b1220').text('INTEGRITY SUMMARY');
    doc.moveDown(0.25);
    const summaryLabels: Array<[string, number | undefined]> = [
      ['Total Evidence', summary.totalEvidence],
      ['Verified', summary.verifiedEvidence],
      ['Failed', summary.failedEvidence],
      ['Pending', summary.pendingEvidence],
      ['Tamper Detected', summary.tamperDetected],
    ];
    const colW = width / summaryLabels.length;
    const summaryY = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155');
    summaryLabels.forEach(([label], i) => doc.text(label.toUpperCase(), 50 + i * colW, summaryY, { width: colW, lineBreak: false }));
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0b1220');
    summaryLabels.forEach(([, value], i) => doc.text(String(value ?? 0), 50 + i * colW, doc.y + 4, { width: colW, lineBreak: false }));
    doc.moveDown(1.2);

    // ── Evidence details ───────────────────────────────────
    const details = (report.content && report.content.evidenceDetails) || [];
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0b1220').text('EVIDENCE DETAILS');
    doc.moveDown(0.25);
    if (details.length === 0) {
      doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('No evidence records found in this report.');
      doc.moveDown(0.5);
    } else {
      const detailCols: Array<[string, number, (e: any) => string]> = [
        ['EVIDENCE ID', 0.24, (e) => String(e.evidenceId || '')],
        ['FILE', 0.24, (e) => String(e.fileName || '')],
        ['SHA-256', 0.3, (e) => String(e.sha256Hash || '')],
        ['INTEGRITY', 0.12, (e) => String(e.integrityStatus || '')],
        ['ON-CHAIN', 0.1, (e) => (e.blockchainVerified ? 'Yes' : 'No')],
      ];
      const headerY = doc.y;
      let cx = 50;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#475569');
      for (const [label, frac] of detailCols) {
        doc.text(label, cx, headerY, { width: width * frac, lineBreak: false });
        cx += width * frac;
      }
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(7.5).fillColor('#0b1220');
      for (const e of details) {
        const rowY = doc.y;
        cx = 50;
        for (const [, frac, get] of detailCols) {
          doc.text(get(e), cx, rowY, { width: width * frac, lineBreak: false });
          cx += width * frac;
        }
        doc.moveDown(0.4);
      }
      doc.moveDown(0.4);
    }

    // ── Custody timeline ───────────────────────────────────
    const timelines = (report.content && report.content.custodyTimeline) || [];
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0b1220').text('CUSTODY TIMELINE');
    doc.moveDown(0.25);
    if (timelines.length === 0) {
      doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('No custody events recorded for this report.');
      doc.moveDown(0.5);
    } else {
      for (const tl of timelines) {
        const events = tl.events || [];
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f766e').text(`Evidence: ${tl.evidenceId || 'N/A'}  (${events.length} events)`);
        doc.moveDown(0.15);
        for (const ev of events) {
          const line = `${fmtDate(ev.timestamp)}  [${ev.eventType}]  ${ev.performedBy || ''}  ${ev.integrityStatus ? '(' + ev.integrityStatus + ')' : ''}`;
          doc.font('Courier').fontSize(7.5).fillColor('#1e293b').text(line, { width });
          if (ev.details) {
            doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(`      ${ev.details}`, { width: width - 20 });
          }
          doc.moveDown(0.15);
        }
        doc.moveDown(0.35);
      }
    }

    // ── Tamper alerts ──────────────────────────────────────
    const tamperAlerts = (report.content && report.content.tamperAlerts) || [];
    if (tamperAlerts.length > 0) {
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#991b1b').text('TAMPER ALERTS');
      doc.moveDown(0.25);
      for (const alert of tamperAlerts) {
        doc.font('Helvetica').fontSize(9).fillColor('#1e293b').text(`${alert.severity?.toUpperCase()} — ${alert.evidenceId}: ${alert.description || ''}`, { width });
        doc.moveDown(0.2);
      }
    }

    // ── Certification block ────────────────────────────────
    doc.addPage();
    doc.moveDown(1.5);
    const boxY = doc.y;
    doc.rect(50, boxY, width, 160).fillAndStroke('#f8fafc', '#94a3b8');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0b1220').text('CERTIFICATION OF CHAIN OF CUSTODY', 60, boxY + 15);
    doc.font('Helvetica').fontSize(9).fillColor('#334155').text(
      'This report certifies the chain of custody and integrity status of the listed evidence as recorded by the NyxTrace platform. ' +
      'Every custody event is hashed into an immutable chain, and each evidence fingerprint is anchored to the blockchain. ' +
      'Any modification to the underlying evidence after collection would produce a verification failure recorded in this chain.',
      60, boxY + 35, { width: width - 20, lineBreak: true }
    );
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0b1220').text('Report Hash:  ', 60, boxY + 95, { continued: true });
    doc.font('Courier').fontSize(8).fillColor('#334155').text(report.reportHash || 'N/A');
    doc.font('Helvetica').fontSize(9).fillColor('#334155').text(`Generated by ${report.generatedByName || 'N/A'} at ${fmtDate(report.generatedAt)}`, 60, boxY + 112, { width: width - 20 });
    doc.font('Helvetica').fontSize(9).fillColor('#475569').text('_____________________________', 60, boxY + 135, { width });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0b1220').text('Authorized Signatory', 60, boxY + 148, { width });
    doc.y = boxY + 175;
    doc.font('Helvetica').fontSize(8).fillColor('#94a3b8').text('This document is system-generated and does not require a physical signature to be valid.', 60, doc.y, { width: width - 20 });

    // ── Footer with page numbers ───────────────────────────
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i += 1) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#94a3b8')
        .text(`NyxTrace — ${report.reportId || ''} — Page ${i + 1} of ${pageCount}`, 50, doc.page.height - 40, { width, align: 'center' });
    }

    doc.end();
    return done;
  }

  /**
   * Get evidence lineage graph
   */
  async getEvidenceLineageGraph(investigationId: string): Promise<{
    nodes: Array<{ id: string; type: string; label: string; metadata: any }>;
    edges: Array<{ source: string; target: string; relationship: string }>;
  }> {
    // Get all evidence for investigation
    const evidenceItems = await Evidence.find({ investigationId }).lean();
    const nodes = [];
    const edges = [];

    for (const evidence of evidenceItems) {
      const lineage = await EvidenceLineage.findOne({ evidenceId: evidence.evidenceId }).lean();

      nodes.push({
        id: evidence.evidenceId || evidence._id.toString(),
        type: lineage?.lineageType || 'original',
        label: evidence.name || evidence.evidenceId || evidence._id.toString(),
        metadata: {
          createdAt: evidence.createdAt,
          integrityStatus: lineage?.lineageType,
        },
      });

      if (lineage?.parentEvidenceId) {
        edges.push({
          source: lineage.parentEvidenceId.toString(),
          target: evidence.evidenceId || evidence._id.toString(),
          relationship: 'derived_from',
        });
      }

      if (lineage?.childEvidenceIds) {
        for (const childId of lineage.childEvidenceIds) {
          edges.push({
            source: evidence.evidenceId || evidence._id.toString(),
            target: childId.toString(),
            relationship: 'produces',
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Get integrity statistics
   */
  async getIntegrityStatistics(): Promise<{
    totalEvidence: number;
    verified: number;
    pending: number;
    failed: number;
    tamperSuspected: number;
    blockchainOnChain: number;
  }> {
    const [total, verified, pending, failed, tamper, onChain] = await Promise.all([
      ChainOfCustody.countDocuments(),
      ChainOfCustody.countDocuments({ integrityStatus: IntegrityStatus.VERIFIED }),
      ChainOfCustody.countDocuments({ integrityStatus: IntegrityStatus.PENDING_VERIFICATION }),
      ChainOfCustody.countDocuments({ integrityStatus: IntegrityStatus.VERIFICATION_FAILED }),
      ChainOfCustody.countDocuments({ integrityStatus: IntegrityStatus.TAMPER_SUSPECTED }),
      ChainOfCustody.countDocuments({ blockchainVerified: true }),
    ]);

    return { totalEvidence: total, verified, pending, failed, tamperSuspected: tamper, blockchainOnChain: onChain };
  }

  /**
   * Resolve an evidence document by Mongo _id or by its string evidenceId.
   */
  private async resolveEvidence(evidenceId: string): Promise<any | null> {
    try {
      const byId = await Evidence.findById(evidenceId).lean();
      if (byId) return byId;
    } catch {
      // Not a valid ObjectId — fall through to string lookup
    }
    return Evidence.findOne({ evidenceId }).lean();
  }

  /**
   * Generate hash for chain
   */
  private generateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

export const chainOfCustodyService = new ChainOfCustodyService();
export default chainOfCustodyService;
