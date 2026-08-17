/**
 * Evidence Demo Mode Tests
 * Verifies tamper simulation + restore flows (DEMO_MODE endpoints).
 */

import '../tests/setup';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Evidence } from '../models';
import { evidenceService } from './evidence.service';
import { config } from '../config';
import { ValidationError, NotFoundError } from '../middleware';

const TEST_USER = new mongoose.Types.ObjectId().toString();
const TEST_INVESTIGATION = new mongoose.Types.ObjectId().toString();

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function createEvidence(
  content: string
): Promise<{ id: string; filePath: string; originalHash: string }> {
  const evidenceId = uuidv4();
  const safeFilename = `${evidenceId}.txt`;
  const filePath = path.join(config.evidence.path, safeFilename);

  fs.mkdirSync(config.evidence.path, { recursive: true });
  fs.writeFileSync(filePath, content);

  const originalHash = sha256(content);

  const evidence = await Evidence.create({
    evidenceId,
    investigationId: TEST_INVESTIGATION,
    name: safeFilename,
    description: 'Demo test evidence',
    type: 'other',
    status: 'ready',
    filePath,
    fileName: safeFilename,
    fileSize: Buffer.byteLength(content),
    mimeType: 'text/plain',
    hash: { sha256: originalHash },
    chainOfCustody: [
      {
        timestamp: new Date(),
        action: 'uploaded',
        userId: TEST_USER,
        details: 'Uploaded',
      },
    ],
    collectedAt: new Date(),
    collectedBy: TEST_USER,
    verificationStatus: 'pending',
    verified: false,
  });

  return { id: evidence._id.toString(), filePath, originalHash };
}

describe('EvidenceService (demo mode)', () => {
  afterAll(() => {
    const dir = config.evidence.path;
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach((f) => {
        if (f.endsWith('.demo.bak') || /^[0-9a-f-]{36}\.txt$/.test(f)) {
          fs.unlinkSync(path.join(dir, f));
        }
      });
    }
  });

  describe('simulateTamper', () => {
    it('appends a marker, backs up the original, and marks the record modified', async () => {
      const { id, filePath, originalHash } = await createEvidence('original content');

      const result = await evidenceService.simulateTamper(id);

      expect(result.tampered).toBe(true);
      expect(fs.existsSync(`${filePath}.demo.bak`)).toBe(true);
      expect(fs.readFileSync(`${filePath}.demo.bak`, 'utf-8')).toBe('original content');
      expect(result.newHash).not.toBe(originalHash);

      const record = await Evidence.findById(id);
      expect(record!.verified).toBe(false);
      expect(record!.verificationStatus).toBe('modified');
      expect(record!.tamperedHash).toBe(result.newHash);
      expect(record!.status).toBe('tampered');
    });

    it('causes verifyIntegrity to report a mismatch', async () => {
      const { id } = await createEvidence('original content');
      await evidenceService.simulateTamper(id);

      const result = await evidenceService.verifyIntegrity(id);
      expect(result.verified).toBe(false);
      const record = await Evidence.findById(id);
      expect(result.currentHash).not.toBe(record!.hash!.sha256);
    });

    it('rejects a second tamper with ValidationError', async () => {
      const { id } = await createEvidence('original content');
      await evidenceService.simulateTamper(id);

      await expect(evidenceService.simulateTamper(id)).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError for unknown evidence', async () => {
      await expect(
        evidenceService.simulateTamper(new mongoose.Types.ObjectId().toString())
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('restoreTamper', () => {
    it('restores the original bytes and removes the backup', async () => {
      const { id, filePath, originalHash } = await createEvidence('original content');
      await evidenceService.simulateTamper(id);

      const result = await evidenceService.restoreTamper(id);

      expect(result.restored).toBe(true);
      expect(result.currentHash).toBe(originalHash);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('original content');
      expect(fs.existsSync(`${filePath}.demo.bak`)).toBe(false);

      const record = await Evidence.findById(id);
      expect(record!.verificationStatus).toBe('pending');
      expect(record!.tamperedHash).toBeUndefined();
      expect(record!.status).toBe('ready');
    });

    it('rejects restore when no backup exists', async () => {
      const { id } = await createEvidence('original content');
      await expect(evidenceService.restoreTamper(id)).rejects.toThrow(ValidationError);
    });

    it('verifyIntegrity passes after restore', async () => {
      const { id, originalHash } = await createEvidence('original content');
      await evidenceService.simulateTamper(id);
      await evidenceService.restoreTamper(id);

      const result = await evidenceService.verifyIntegrity(id);
      expect(result.verified).toBe(true);
      expect(result.currentHash).toBe(originalHash);
    });
  });
});
