/**
 * Evidence Service
 * Business logic for evidence management and file handling
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Evidence } from '../models';
import { EvidenceType } from '../types';
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
   * Upload evidence file
   */
  async uploadEvidence(data: {
    investigationId: string;
    file: Express.Multer.File;
    description?: string;
    type?: EvidenceType;
    collectedBy: string;
    collectedAt?: Date;
    tags?: string[];
  }): Promise<any> {
    // Verify investigation exists
    const { Investigation } = await import('../models');
    const investigation = await Investigation.findById(data.investigationId);
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

    // Create evidence record
    const evidence = await Evidence.create({
      evidenceId: fileId,
      fileName: data.file.originalname,
      investigationId: data.investigationId,
      name: data.file.originalname,
      description: data.description,
      type: data.type || this.detectEvidenceType(data.file.mimetype),
      filePath,
      fileSize: data.file.size,
      mimeType: data.file.mimetype,
      hash: { sha256: hash },
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
   * Get evidence by ID
   */
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

    const currentHash = await this.calculateFileHash(evidence.filePath);
    const verified = currentHash === evidence.hash?.sha256;

    if (verified) {
      evidence.verified = true;
      await evidence.save();
    }

    return { verified, currentHash };
  }

  /**
   * Delete evidence
   */
  async delete(id: string): Promise<void> {
    const evidence = await Evidence.findById(id);
    if (!evidence) {
      throw new NotFoundError('Evidence');
    }

    // Delete file
    if (fs.existsSync(evidence.filePath)) {
      fs.unlinkSync(evidence.filePath);
    }

    // Update investigation count
    const { Investigation } = await import('../models');
    await Investigation.updateOne(
      { _id: evidence.investigationId },
      { $inc: { evidenceCount: -1 } }
    );

    await Evidence.findByIdAndDelete(id);
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