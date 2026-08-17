import '../setup';
import request from 'supertest';
import crypto from 'crypto';
import app from '../../index';
import { generateAuthToken } from '../helpers';
import { createUser, createEvidence, createInvestigation } from '../factories';
import { UserRole, EvidenceType } from '../../types';

describe('Evidence-Driven Analysis Flow', () => {
  describe('POST /api/v1/evidence/url', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).post('/api/v1/evidence/url').send({
        investigationId: 'x',
        url: 'https://evil.example.com/payload',
      });
      expect(res.status).toBe(401);
    });

    it('registers URL evidence with normalized URL and string fingerprint', async () => {
      const user = await createUser({ role: UserRole.FORENSIC_ANALYST });
      const token = generateAuthToken(user._id.toString(), UserRole.FORENSIC_ANALYST);
      const inv = await createInvestigation();

      const res = await request(app)
        .post('/api/v1/evidence/url')
        .set('Authorization', `Bearer ${token}`)
        .send({
          investigationId: inv._id.toString(),
          url: 'evil.example.com/payload',
          name: 'Suspicious payload URL',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const evidence = res.body.data.evidence;
      expect(evidence.type).toBe(EvidenceType.URL);
      expect(evidence.url).toBe('http://evil.example.com/payload');
      expect(evidence.status).toBe('ready');
      expect(evidence.filePath).toBeUndefined();
      expect(evidence.fileName).toBeUndefined();
      expect(evidence.fileSize).toBeUndefined();
      expect(evidence.hash.sha256).toBe(
        crypto.createHash('sha256').update('http://evil.example.com/payload').digest('hex')
      );
      expect(evidence.chainOfCustody[0].action).toBe('registered');
    });

    it('returns 400 when investigationId or url is missing', async () => {
      const user = await createUser({ role: UserRole.FORENSIC_ANALYST });
      const token = generateAuthToken(user._id.toString(), UserRole.FORENSIC_ANALYST);

      const res = await request(app)
        .post('/api/v1/evidence/url')
        .set('Authorization', `Bearer ${token}`)
        .send({ investigationId: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/sandbox/sessions (evidence-driven)', () => {
    it('analyzes URL evidence into a completed analysis session', async () => {
      const user = await createUser({ role: UserRole.FORENSIC_ANALYST });
      const token = generateAuthToken(user._id.toString(), UserRole.FORENSIC_ANALYST);
      const inv = await createInvestigation();
      const evidence = await createEvidence({
        type: EvidenceType.URL,
        url: 'https://suspicious.example.com/login?token=abc',
        name: 'phish-url.txt',
        hash: {
          sha256: crypto.createHash('sha256').update('https://suspicious.example.com/login?token=abc').digest('hex'),
        },
      });

      const res = await request(app)
        .post('/api/v1/sandbox/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ evidenceId: evidence._id.toString() });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const session = res.body.data.session;
      expect(session.sessionId).toMatch(/^ANL-/);
      expect(session.kind).toBe('url');
      expect(session.status).toBe('completed');
      expect(session.simulatorName).toBe('URL Analysis');
      expect(session.evidenceId?.toString()).toBe(evidence._id.toString());
      expect(session.aiAnalysis).toBeDefined();
      expect(session.aiAnalysis.threat_classification).toBeDefined();
    });

    it('records post-analysis custody events and verifies integrity', async () => {
      const user = await createUser({ role: UserRole.FORENSIC_ANALYST });
      const token = generateAuthToken(user._id.toString(), UserRole.FORENSIC_ANALYST);
      const evidence = await createEvidence({
        type: EvidenceType.URL,
        url: 'https://suspicious.example.com/payload',
        hash: {
          sha256: crypto.createHash('sha256').update('https://suspicious.example.com/payload').digest('hex'),
        },
      });

      await request(app)
        .post('/api/v1/sandbox/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ evidenceId: evidence._id.toString() });

      const res = await request(app)
        .get(`/api/v1/evidence/${evidence._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const updated = res.body.data.evidence;
      const actions = updated.chainOfCustody.map((c: any) => c.action);
      expect(actions).toContain('analysis_completed');
      expect(actions).toContain('integrity_checked');
      expect(updated.verificationStatus).toBe('verified');
    });

    it('rejects re-analysis of the same evidence with 409', async () => {
      const user = await createUser({ role: UserRole.FORENSIC_ANALYST });
      const token = generateAuthToken(user._id.toString(), UserRole.FORENSIC_ANALYST);
      const evidence = await createEvidence({
        type: EvidenceType.URL,
        url: 'https://suspicious.example.com/payload',
        hash: {
          sha256: crypto.createHash('sha256').update('https://suspicious.example.com/payload').digest('hex'),
        },
      });

      const first = await request(app)
        .post('/api/v1/sandbox/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ evidenceId: evidence._id.toString() });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post('/api/v1/sandbox/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ evidenceId: evidence._id.toString() });

      expect(second.status).toBe(409);
      expect(second.body.message).toContain('already been analyzed');
    });

    it('returns 404 for unknown evidenceId', async () => {
      const user = await createUser({ role: UserRole.FORENSIC_ANALYST });
      const token = generateAuthToken(user._id.toString(), UserRole.FORENSIC_ANALYST);

      const res = await request(app)
        .post('/api/v1/sandbox/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ evidenceId: '000000000000000000000000' });

      expect(res.status).toBe(404);
    });

    it('requires a simulator when executable evidence has no hint', async () => {
      const user = await createUser({ role: UserRole.FORENSIC_ANALYST });
      const token = generateAuthToken(user._id.toString(), UserRole.FORENSIC_ANALYST);
      const evidence = await createEvidence({
        type: EvidenceType.EXECUTABLE,
        name: 'sample.exe',
        simulatorHint: undefined,
      });

      const res = await request(app)
        .post('/api/v1/sandbox/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ evidenceId: evidence._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('simulator_id is required');
    });
  });

  describe('POST /api/v1/evidence/upload (with kind + simulatorHint)', () => {
    it('stores the artifact kind and simulator hint and starts READY', async () => {
      const user = await createUser({ role: UserRole.FORENSIC_ANALYST });
      const token = generateAuthToken(user._id.toString(), UserRole.FORENSIC_ANALYST);
      const inv = await createInvestigation();

      const res = await request(app)
        .post('/api/v1/evidence/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('investigationId', inv._id.toString())
        .field('type', 'executable')
        .field('simulatorHint', 'system-service-alpha/ransomware-simulator')
        .attach('file', Buffer.from('MZ fake executable bytes'), 'sample.exe');

      expect(res.status).toBe(201);
      const evidence = res.body.data.evidence;
      expect(evidence.type).toBe(EvidenceType.EXECUTABLE);
      expect(evidence.simulatorHint).toBe('system-service-alpha/ransomware-simulator');
      expect(evidence.status).toBe('ready');
      expect(evidence.fileName).toBe('sample.exe');
    });
  });

  describe('POST /api/v1/evidence/:id/verify (URL-aware)', () => {
    it('verifies URL evidence against its string fingerprint', async () => {
      const user = await createUser({ role: UserRole.FORENSIC_ANALYST });
      const token = generateAuthToken(user._id.toString(), UserRole.FORENSIC_ANALYST);
      const evidence = await createEvidence({
        type: EvidenceType.URL,
        url: 'https://suspicious.example.com/payload',
        hash: {
          sha256: crypto.createHash('sha256').update('https://suspicious.example.com/payload').digest('hex'),
        },
      });

      const res = await request(app)
        .post(`/api/v1/evidence/${evidence._id}/verify`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.verified).toBe(true);
    });
  });
});