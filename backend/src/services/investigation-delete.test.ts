/**
 * Investigation Delete Cascade Tests
 * Verifies investigationService.delete removes evidence (with file unlink),
 * sandbox sessions, analysis reports, alerts, and custody records scoped to
 * the investigation, and that analysis history supports investigationId filtering.
 */

import '../tests/setup';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import investigationService from './investigation.service';
import analysisService from './analysis.service';
import {
  Investigation,
  Evidence,
  SandboxSession,
  AnalysisReport,
  Alert,
  ChainOfCustody,
} from '../models';

describe('Investigation delete cascade', () => {
  let investigationId: mongoose.Types.ObjectId;

  const uploadDir = './uploads/test-investigation-cascade';

  beforeAll(async () => {
    fs.mkdirSync(uploadDir, { recursive: true });
  });

  beforeEach(async () => {
    const investigation = await Investigation.create({
      caseNumber: `CASCADE-${Date.now()}`,
      title: 'Cascade test investigation',
      description: 'Temporary investigation for cascade deletion test',
      status: 'active',
      priority: 'high',
      createdBy: new mongoose.Types.ObjectId(),
    });
    investigationId = investigation._id;
  });

  afterAll(async () => {
    fs.rmSync(uploadDir, { recursive: true, force: true });
    await Investigation.deleteMany({});
  });

  it('deletes evidence (unlinking files), sessions, analysis reports, alerts and custody records', async () => {
    const filePath = path.join(uploadDir, 'cascade-sample.bin');
    fs.writeFileSync(filePath, 'cascade-evidence-content');

    const evidence = await Evidence.create({
      investigationId,
      evidenceId: `EVID-cascade-${Date.now()}`,
      name: 'Cascade evidence',
      type: 'document',
      source: 'manual_upload',
      status: 'verified',
      filePath,
      fileName: 'cascade-sample.bin',
      fileSize: fs.statSync(filePath).size,
      mimeType: 'application/octet-stream',
      sha256: 'abc123',
      collectedBy: new mongoose.Types.ObjectId(),
    });

    const session = await SandboxSession.create({
      sessionId: `ANL-cascade-${Date.now()}`,
      evidenceId: evidence._id,
      simulatorId: 'system-service-alpha',
      simulatorName: 'LockByte Ransomware',
      kind: 'document',
      status: 'completed',
      vmName: 'ForensicsSandbox',
      startTime: new Date(),
    });

    const analysisReport = await AnalysisReport.create({
      analysisId: `ANALYSIS-cascade-${Date.now()}`,
      analysisType: 'document_analysis',
      sourceType: 'docx',
      sourceName: 'cascade-sample.bin',
      investigationId,
      threatScore: 75,
      threatLevel: 'high',
      summary: 'Cascade analysis',
      analysisTimestamp: new Date(),
    });

    const alert = await Alert.create({
      investigationId,
      alertId: `ALERT-cascade-${Date.now()}`,
      title: 'Cascade alert',
      type: 'evidence',
      source: 'manual',
      description: 'Cascade test alert',
      severity: 'high',
      status: 'new',
    });

    await ChainOfCustody.create({
      evidenceId: evidence._id.toString(),
      chainId: `COC-cascade-${Date.now()}`,
      genesisHash: 'genesis',
      chainHash: 'chain',
      eventCount: 1,
      status: 'active',
    });

    await investigationService.delete(investigationId.toString());

    expect(await Investigation.findById(investigationId)).toBeNull();
    expect(await Evidence.findById(evidence._id)).toBeNull();
    expect(fs.existsSync(filePath)).toBe(false);
    expect(await SandboxSession.findById(session._id)).toBeNull();
    expect(await AnalysisReport.findById(analysisReport._id)).toBeNull();
    expect(await Alert.findById(alert._id)).toBeNull();
    expect(await ChainOfCustody.findOne({ evidenceId: evidence._id.toString() })).toBeNull();
  });

  it('throws NotFoundError for unknown investigation', async () => {
    await expect(investigationService.delete(new mongoose.Types.ObjectId().toString())).rejects.toThrow('Investigation');
  });
});

describe('Analysis history investigationId filter', () => {
  let investigationId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    const investigation = await Investigation.create({
      caseNumber: `HIST-${Date.now()}`,
      title: 'History filter investigation',
      description: 'History filter test investigation',
      status: 'active',
      priority: 'medium',
      createdBy: new mongoose.Types.ObjectId(),
    });
    investigationId = investigation._id;

    await AnalysisReport.create({
      analysisId: `ANALYSIS-scoped-${Date.now()}`,
      analysisType: 'url_analysis',
      sourceType: 'url',
      sourceName: 'http://scoped.example.com',
      investigationId,
      threatScore: 60,
      threatLevel: 'high',
      summary: 'Scoped report',
      analysisTimestamp: new Date(),
    });
    await AnalysisReport.create({
      analysisId: `ANALYSIS-other-${Date.now()}`,
      analysisType: 'document_analysis',
      sourceType: 'docx',
      sourceName: 'unscoped.docx',
      threatScore: 10,
      threatLevel: 'low',
      summary: 'Unscoped report',
      analysisTimestamp: new Date(),
    });
  });

  afterEach(async () => {
    await AnalysisReport.deleteMany({});
    await Investigation.deleteMany({});
  });

  it('returns only reports belonging to the investigation when filtered', async () => {
    const scoped = await analysisService.getAnalysisHistory(1, 20, undefined, investigationId.toString());
    expect(scoped.total).toBe(1);
    expect(scoped.items[0].sourceName).toBe('http://scoped.example.com');

    const all = await analysisService.getAnalysisHistory(1, 20);
    expect(all.total).toBeGreaterThanOrEqual(2);
  });
});