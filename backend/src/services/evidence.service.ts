/**
 * Evidence Service
 * Business logic for evidence management and file handling
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Evidence } from '../models';
import { EvidenceType, EvidenceStatus } from '../types';
import { NotFoundError, ValidationError, ForbiddenError } from '../middleware';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

export class EvidenceService {
  /**
   * Initialize storage directories
   */
  initializeStorage(): void {
    const dirs = [config.evidence.path, config.evidence.reportsPath, config.evidence.sandboxLogsPath];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Resolve an investigation by Mongo ObjectId or by caseNumber. Evidence
   * records link investigations via the human-readable caseNumber (e.g.
   * "CASE-2026-..."), so user-supplied investigationIds must not be cast
   * straight to ObjectId.
   */
  private async resolveInvestigation(investigationId: string | mongoose.Types.ObjectId): Promise<any | null> {
    const { Investigation } = await import('../models');
    const id = investigationId.toString();
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    return isObjectId
      ? Investigation.findById(id)
      : Investigation.findOne({ caseNumber: id });
  }

  /**
   * Upload evidence file
   */
  async uploadEvidence(data: {
    investigationId: string;
    file: Express.Multer.File;
    description?: string;
    type?: EvidenceType;
    simulatorHint?: string;
    collectedBy: string;
    collectedAt?: Date;
    tags?: string[];
  }): Promise<any> {
    // Verify investigation exists (by _id or caseNumber)
    const { Investigation } = await import('../models');
    const investigation = await this.resolveInvestigation(data.investigationId);
    if (!investigation) {
      throw new NotFoundError('Investigation');
    }

    // Generate unique filename
    const fileExt = path.extname(data.file.originalname);
    const fileId = uuidv4();
    const safeFilename = `${fileId}${fileExt}`;
    const filePath = path.join(config.evidence.path, safeFilename);

    // Move file to storage
    fs.renameSync(data.file.path, filePath);

    // Calculate file hash
    const hash = await this.calculateFileHash(filePath);

    const type = data.type || this.detectEvidenceType(data.file.mimetype);
    const status = type === EvidenceType.EXECUTABLE
      ? EvidenceStatus.READY
      : EvidenceStatus.UPLOADING;

    // Create evidence record
    const evidence = await Evidence.create({
      evidenceId: fileId,
      fileName: data.file.originalname,
      investigationId: data.investigationId,
      name: data.file.originalname,
      description: data.description,
      type,
      simulatorHint: data.simulatorHint,
      filePath,
      fileSize: data.file.size,
      mimeType: data.file.mimetype,
      hash: { sha256: hash },
      status,
      chainOfCustody: [
        {
          timestamp: data.collectedAt || new Date(),
          action: 'uploaded',
          userId: data.collectedBy,
          details: `File uploaded: ${data.file.originalname}`,
        },
      ],
      collectedAt: data.collectedAt || new Date(),
      collectedBy: data.collectedBy,
      tags: data.tags || [],
    });

    // Update investigation evidence count
    await Investigation.updateOne(
      { _id: investigation._id },
      { $inc: { evidenceCount: 1 } }
    );

    return evidence;
  }

  /**
   * Register a URL as evidence (artifact found in the forensic event).
   * URL evidence has no file on disk — its SHA-256 fingerprint is computed
   * over the normalized URL string and can be anchored on the blockchain.
   */
  async registerUrlEvidence(data: {
    investigationId: string;
    url: string;
    name?: string;
    description?: string;
    collectedBy: string;
    collectedAt?: Date;
    tags?: string[];
  }): Promise<any> {
    const { Investigation } = await import('../models');
    const investigation = await this.resolveInvestigation(data.investigationId);
    if (!investigation) {
      throw new NotFoundError('Investigation');
    }

    const normalized = this.normalizeUrl(data.url);
    const fileId = uuidv4();
    const hash = this.calculateDataHash(normalized);

    const evidence = await Evidence.create({
      evidenceId: fileId,
      investigationId: data.investigationId,
      name: data.name || normalized,
      description: data.description,
      type: EvidenceType.URL,
      url: normalized,
      status: EvidenceStatus.READY,
      hash: { sha256: hash },
      chainOfCustody: [
        {
          timestamp: data.collectedAt || new Date(),
          action: 'registered',
          userId: data.collectedBy,
          details: `URL registered as evidence: ${normalized}`,
        },
      ],
      collectedAt: data.collectedAt || new Date(),
      collectedBy: data.collectedBy,
      tags: data.tags || [],
    });

    await Investigation.updateOne(
      { _id: data.investigationId },
      { $inc: { evidenceCount: 1 } }
    );

    return evidence;
  }

  /**
   * Get all evidence for an investigation
   */
  async findByInvestigation(
    investigationId: string,
    options: { page: number; limit: number; type?: EvidenceType }
  ): Promise<{ evidence: any[]; total: number; totalPages: number }> {
    const { page, limit, type } = options;

    const query: Record<string, any> = { investigationId };
    if (type) query.type = type;

    const total = await Evidence.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const evidence = await Evidence.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return { evidence: evidence as any, total, totalPages };
  }

  /**
   * Get all evidence with pagination, search, and type filters
   */
  async findAll(options: {
    page: number;
    limit: number;
    search?: string;
    type?: EvidenceType;
    status?: string;
  }): Promise<{ evidence: any[]; total: number; totalPages: number }> {
    const { page, limit, search, type, status } = options;

    const query: Record<string, any> = {};

    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { evidenceId: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Evidence.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const evidence = await Evidence.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return { evidence: evidence as any, total, totalPages };
  }

  /**
   * Get evidence by ID
   */
  /**
   * Resolve an evidence document by Mongo _id or by its public evidenceId string.
   */
  private async resolveEvidence(id: string): Promise<any | null> {
    try {
      const byId = await Evidence.findById(id);
      if (byId) return byId;
    } catch {
      // Not a valid ObjectId — fall through to string lookup
    }
    return Evidence.findOne({ evidenceId: id });
  }

  async findById(id: string): Promise<any> {
    const evidence = await Evidence.findById(id).lean();
    if (!evidence) {
      throw new NotFoundError('Evidence');
    }
    return evidence as any;
  }

  /**
   * Add chain of custody entry
   */
  async addChainOfCustody(
    id: string,
    action: string,
    userId: string,
    details: string
  ): Promise<any> {
    const evidence = await Evidence.findById(id);
    if (!evidence) {
      throw new NotFoundError('Evidence');
    }

    evidence.chainOfCustody.push({
      timestamp: new Date(),
      action,
      userId,
      details,
    });

    await evidence.save();
    return evidence;
  }

  /**
   * Verify evidence integrity
   */
  async verifyIntegrity(id: string): Promise<{ verified: boolean; currentHash: string }> {
    const evidence = await Evidence.findById(id);
    if (!evidence) {
      throw new NotFoundError('Evidence');
    }

    const currentHash = await this.calculateEvidenceHash(evidence);
    const verified = currentHash === evidence.hash?.sha256;

    if (verified) {
      evidence.verified = true;
      evidence.status = EvidenceStatus.VERIFIED;
      evidence.verificationStatus = 'verified';
      await evidence.save();
    } else {
      evidence.verified = false;
      evidence.status = EvidenceStatus.TAMPERED;
      evidence.verificationStatus = 'modified';
      await evidence.save();
    }

    return { verified, currentHash };
  }

  /**
   * Simulate tampering with an evidence file (demo mode only).
   * Backs up the original file, then appends a marker so the next
   * integrity check reports a hash mismatch.
   */
  async simulateTamper(id: string): Promise<{ tampered: boolean; backupPath: string; newHash: string }> {
    const evidence = await this.resolveEvidence(id);
    if (!evidence) {
      throw new NotFoundError('Evidence');
    }

    if (evidence.type === EvidenceType.URL) {
      throw new ValidationError('URL evidence has no artifact on disk — tamper simulation is only available for file-based evidence', []);
    }

    const backupPath = `${evidence.filePath}.demo.bak`;
    if (fs.existsSync(backupPath)) {
      throw new ValidationError('Evidence already tampered — restore it first', []);
    }

    if (!fs.existsSync(evidence.filePath)) {
      throw new NotFoundError(`Evidence file at ${evidence.filePath}`);
    }

    // Preserve the original file, then mutate it
    fs.copyFileSync(evidence.filePath, backupPath);
    fs.appendFileSync(evidence.filePath, `\n[NYXTRACE_DEMO_TAMPER] ${new Date().toISOString()}\n`);

    const newHash = await this.calculateFileHash(evidence.filePath);

    // Persist the tampered state on the evidence record
    evidence.verified = false;
    evidence.status = EvidenceStatus.TAMPERED;
    evidence.verificationStatus = 'modified';
    evidence.tamperedHash = newHash;
    await evidence.save();

    return { tampered: true, backupPath, newHash };
  }

  /**
   * Restore a tampered evidence file from its demo backup (demo mode only).
   */
  async restoreTamper(id: string): Promise<{ restored: boolean; currentHash: string }> {
    const evidence = await this.resolveEvidence(id);
    if (!evidence) {
      throw new NotFoundError('Evidence');
    }

    const backupPath = `${evidence.filePath}.demo.bak`;
    if (!fs.existsSync(backupPath)) {
      throw new ValidationError('No demo backup found for this evidence', []);
    }

    fs.copyFileSync(backupPath, evidence.filePath);
    fs.unlinkSync(backupPath);

    const currentHash = await this.calculateFileHash(evidence.filePath);

    // Clear the tampered state; integrity is re-established by verification
    evidence.verified = false;
    evidence.status = EvidenceStatus.READY;
    evidence.verificationStatus = 'pending';
    evidence.tamperedHash = undefined;
    await evidence.save();

    return { restored: true, currentHash };
  }

  /**
   * Delete evidence
   */
  async delete(id: string): Promise<void> {
    const evidence = await Evidence.findById(id);
    if (!evidence) {
      throw new NotFoundError('Evidence');
    }

    // Delete file (URL evidence has no artifact on disk)
    if (evidence.filePath && fs.existsSync(evidence.filePath)) {
      fs.unlinkSync(evidence.filePath);
    }

    // Update investigation count
    const { Investigation } = await import('../models');
    const investigation = await this.resolveInvestigation(evidence.investigationId);
    if (investigation) {
      await Investigation.updateOne(
        { _id: investigation._id },
        { $inc: { evidenceCount: -1 } }
      );
    }

    await Evidence.findByIdAndDelete(id);
  }

  /**
   * Normalize a URL for evidence registration and hashing.
   * Adds a scheme when missing and normalizes the host to lowercase.
   */
  normalizeUrl(rawUrl: string): string {
    const trimmed = (rawUrl || '').trim();
    if (!trimmed) {
      throw new ValidationError('URL is required', []);
    }
    try {
      const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `http://${trimmed}`);
      return parsed.toString().replace(/\/$/, '');
    } catch {
      throw new ValidationError('Invalid URL format', []);
    }
  }

  /**
   * Calculate SHA-256 of an evidence record's content.
   * Files are hashed from disk; URL evidence is hashed from the URL string.
   */
  private async calculateEvidenceHash(evidence: any): Promise<string> {
    if (evidence.type === EvidenceType.URL) {
      return this.calculateDataHash(this.normalizeUrl(evidence.url));
    }
    return this.calculateFileHash(evidence.filePath);
  }

  /**
   * Calculate SHA-256 hash of raw data
   */
  private calculateDataHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Calculate SHA-256 hash of file
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Detect evidence type from MIME type
   */
  private detectEvidenceType(mimeType: string): EvidenceType {
    if (mimeType.includes('image')) return EvidenceType.SCREENSHOT;
    if (mimeType.includes('json')) return EvidenceType.REPORT;
    if (mimeType.includes('pcap') || mimeType.includes('tcpdump')) return EvidenceType.NETWORK_CAPTURE;
    if (mimeType.includes('log')) return EvidenceType.LOG;
    return EvidenceType.OTHER;
  }
}

export const evidenceService = new EvidenceService();
export default evidenceService;