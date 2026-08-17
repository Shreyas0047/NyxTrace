/**
 * Chain of Custody Service Tests
 * Verifies string-keyed evidence chains (e.g. `SANDBOX-<uuid>`), tamper
 * investigation flow, verification reports and PDF export.
 */

import '../tests/setup';
import mongoose from 'mongoose';
import { chainOfCustodyService } from './custody.service';
import {
  ChainOfCustody,
  EvidenceLineage,
  TamperInvestigation,
  VerificationReport,
  IntegrityStatus,
  CustodyEventType,
} from '../models/custody.model';

const TEST_USER = new mongoose.Types.ObjectId().toString();
const TEST_USER_NAME = 'Test Analyst';
const EVIDENCE_ID = 'SANDBOX-custody-test-001';

describe('ChainOfCustodyService', () => {
  describe('addEvent', () => {
    it('auto-initializes a chain for a string evidenceId', async () => {
      await chainOfCustodyService.addEvent({
        evidenceId: EVIDENCE_ID,
        eventType: CustodyEventType.EVIDENCE_UPLOADED,
        performedBy: TEST_USER,
        performedByName: TEST_USER_NAME,
        details: 'Test evidence uploaded',
        integrityStatus: IntegrityStatus.PENDING_VERIFICATION,
      });

      const chain = await ChainOfCustody.findOne({ evidenceId: EVIDENCE_ID });
      expect(chain).not.toBeNull();
      expect(chain!.chainId).toMatch(/^COC-/);
      expect(chain!.events.length).toBe(2); // genesis + uploaded
      expect(chain!.eventCount).toBe(2);
      expect(chain!.genesisHash).toBeDefined();
      expect(chain!.chainHash).not.toBe(chain!.genesisHash);
      expect(chain!.events[0].eventType).toBe(CustodyEventType.EVIDENCE_CREATED);
      expect(chain!.events[1].eventType).toBe(CustodyEventType.EVIDENCE_UPLOADED);
      expect(chain!.events[1].performedByName).toBe(TEST_USER_NAME);

      const lineage = await EvidenceLineage.findOne({ evidenceId: EVIDENCE_ID });
      expect(lineage).not.toBeNull();
      expect(lineage!.lineageType).toBe('original');
    });

    it('appends events to an existing chain with hash chaining', async () => {
      await chainOfCustodyService.addEvent({
        evidenceId: EVIDENCE_ID,
        eventType: CustodyEventType.ANALYST_ACCESSED,
        performedBy: TEST_USER,
        performedByName: TEST_USER_NAME,
        details: 'Analyst accessed evidence',
      });

      const chain = await ChainOfCustody.findOne({ evidenceId: EVIDENCE_ID });
      const firstHash = chain!.chainHash;

      await chainOfCustodyService.addEvent({
        evidenceId: EVIDENCE_ID,
        eventType: CustodyEventType.INTEGRITY_CHECKED,
        performedBy: TEST_USER,
        performedByName: TEST_USER_NAME,
        details: 'Integrity check performed',
      });

      const updated = await ChainOfCustody.findOne({ evidenceId: EVIDENCE_ID });
      expect(updated!.events.length).toBe(3);
      expect(updated!.chainHash).not.toBe(firstHash);
      expect(updated!.events[2].previousEventHash).toBe(firstHash);
      expect(updated!.events[2].currentEventHash).toBe(updated!.chainHash);
    });
  });

  describe('getChainVisualization', () => {
    it('returns visualization for existing chain and null for missing', async () => {
      await chainOfCustodyService.addEvent({
        evidenceId: EVIDENCE_ID,
        eventType: CustodyEventType.VERIFICATION_COMPLETED,
        performedBy: TEST_USER,
        performedByName: TEST_USER_NAME,
        details: 'Verification completed',
      });

      const vis = await chainOfCustodyService.getChainVisualization(EVIDENCE_ID);
      expect(vis).not.toBeNull();
      expect(vis!.evidenceId).toBe(EVIDENCE_ID);
      expect(vis!.chainId).toMatch(/^COC-/);
      expect(vis!.integrityStatus).toBe(IntegrityStatus.PENDING_VERIFICATION);
      expect(vis!.blockchainVerified).toBe(false);
      expect(vis!.events.length).toBe(2);
      expect(vis!.events[0]).toHaveProperty('timestamp');
      expect(vis!.events[0]).toHaveProperty('eventType');
      expect(vis!.events[0]).toHaveProperty('performedBy');

      const missing = await chainOfCustodyService.getChainVisualization('SANDBOX-missing-999');
      expect(missing).toBeNull();
    });
  });

  describe('getCustodyTimeline', () => {
    it('returns the full chain document for an evidenceId', async () => {
      await chainOfCustodyService.addEvent({
        evidenceId: EVIDENCE_ID,
        eventType: CustodyEventType.EVIDENCE_EXPORTED,
        performedBy: TEST_USER,
        performedByName: TEST_USER_NAME,
        details: 'Evidence exported for analysis',
      });

      const timeline = await chainOfCustodyService.getCustodyTimeline(EVIDENCE_ID);
      expect(timeline).not.toBeNull();
      expect(timeline.evidenceId).toBe(EVIDENCE_ID);
      expect(timeline.events.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('transferCustody', () => {
    it('updates current holder and records a transfer event', async () => {
      await chainOfCustodyService.addEvent({
        evidenceId: EVIDENCE_ID,
        eventType: CustodyEventType.EVIDENCE_CREATED,
        performedBy: TEST_USER,
        performedByName: TEST_USER_NAME,
        details: 'Initial custody',
      });

      const newHolderId = new mongoose.Types.ObjectId().toString();
      await chainOfCustodyService.transferCustody(
        EVIDENCE_ID,
        newHolderId,
        'Second Analyst',
        TEST_USER,
        TEST_USER_NAME
      );

      const chain = await ChainOfCustody.findOne({ evidenceId: EVIDENCE_ID });
      expect(chain!.currentHolderName).toBe('Second Analyst');
      const transferEvent = chain!.events.find(
        (e: any) => e.eventType === CustodyEventType.CUSTODY_TRANSFERRED
      );
      expect(transferEvent).toBeDefined();
      expect(transferEvent!.details).toContain('Second Analyst');
    });
  });

  describe('tamper investigations', () => {
    it('creates an open investigation and records a tamper event', async () => {
      const inv = await chainOfCustodyService.createTamperInvestigation(
        EVIDENCE_ID,
        'expected-hash-abc',
        'actual-hash-xyz',
        'critical'
      );

      expect(inv.investigationId).toBeDefined();
      expect(inv.status).toBe('open');
      expect(inv.severity).toBe('critical');
      expect(inv.driftAnalysis.driftCount).toBe(1);

      const chain = await ChainOfCustody.findOne({ evidenceId: EVIDENCE_ID });
      const tamperEvent = chain!.events.find(
        (e: any) => e.eventType === CustodyEventType.TAMPER_DETECTED
      );
      expect(tamperEvent).toBeDefined();

      const open = await chainOfCustodyService.getOpenTamperInvestigations();
      expect(open.length).toBe(1);
      expect(open[0].evidenceId).toBe(EVIDENCE_ID);
    });
  });

  describe('getIntegrityStatistics', () => {
    it('returns counts across chains', async () => {
      const stats = await chainOfCustodyService.getIntegrityStatistics();
      expect(stats).toEqual({
        totalEvidence: 0,
        verified: 0,
        pending: 0,
        failed: 0,
        tamperSuspected: 0,
        blockchainOnChain: 0,
      });

      await chainOfCustodyService.addEvent({
        evidenceId: EVIDENCE_ID,
        eventType: CustodyEventType.EVIDENCE_CREATED,
        performedBy: TEST_USER,
        performedByName: TEST_USER_NAME,
        details: 'Chain created',
      });

      const updated = await chainOfCustodyService.getIntegrityStatistics();
      expect(updated.totalEvidence).toBe(1);
      expect(updated.pending).toBe(1);
    });
  });

  describe('generateVerificationReport', () => {
    it('creates a report for string evidenceIds without requiring an investigation', async () => {
      await chainOfCustodyService.addEvent({
        evidenceId: EVIDENCE_ID,
        eventType: CustodyEventType.EVIDENCE_UPLOADED,
        performedBy: TEST_USER,
        performedByName: TEST_USER_NAME,
        details: 'Uploaded for reporting',
      });

      const report = await chainOfCustodyService.generateVerificationReport(
        undefined,
        [EVIDENCE_ID],
        'chain_of_custody',
        TEST_USER,
        TEST_USER_NAME
      );

      expect(report.reportId).toMatch(/^RPT-/);
      expect(report.reportType).toBe('chain_of_custody');
      expect(report.summary.totalEvidence).toBe(1);
      expect(report.generatedByName).toBe(TEST_USER_NAME);
      expect(report.reportHash).toBeDefined();
      expect(report.content.custodyTimeline.length).toBe(1);
      expect(report.content.custodyTimeline[0].evidenceId).toBe(EVIDENCE_ID);
      expect(report.content.custodyTimeline[0].events.length).toBe(2);

      const stored = await VerificationReport.findOne({ reportId: report.reportId });
      expect(stored).not.toBeNull();
    });
  });

  describe('exportReport', () => {
    it('throws for missing report', async () => {
      await expect(
        chainOfCustodyService.exportReport('RPT-MISSING', 'pdf', TEST_USER)
      ).rejects.toThrow('Report not found');
    });

    it('returns PDF bytes when exportFormat is pdf', async () => {
      const report = await chainOfCustodyService.generateVerificationReport(
        undefined,
        [EVIDENCE_ID],
        'chain_of_custody',
        TEST_USER,
        TEST_USER_NAME
      );

      const exported = await chainOfCustodyService.exportReport(report.reportId, 'pdf', TEST_USER);
      expect(exported.pdfBase64).toBeDefined();
      expect(exported.pdfFileName).toBe(`${report.reportId}.pdf`);

      const decoded = Buffer.from(exported.pdfBase64!, 'base64');
      expect(decoded.length).toBeGreaterThan(500);
      expect(decoded.slice(0, 4).toString('latin1')).toBe('%PDF');

      const updated = await VerificationReport.findOne({ reportId: report.reportId });
      expect(updated!.exportFormat).toBe('pdf');
      expect(updated!.exportedAt).toBeDefined();
    });

    it('returns the report document for json export', async () => {
      const report = await chainOfCustodyService.generateVerificationReport(
        undefined,
        [EVIDENCE_ID],
        'chain_of_custody',
        TEST_USER,
        TEST_USER_NAME
      );

      const exported = await chainOfCustodyService.exportReport(report.reportId, 'json', TEST_USER);
      expect(exported.pdfBase64).toBeUndefined();
      expect(exported.report.reportId).toBe(report.reportId);
    });
  });
});
