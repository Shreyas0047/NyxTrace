import '../setup';
import request from 'supertest';
import app from '../../index';
import { generateAuthToken } from '../helpers';
import { createUser, createEvidence, createInvestigation } from '../factories';
import { UserRole } from '../../types';

describe('Evidence Routes', () => {
  describe('GET /api/v1/evidence', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/v1/evidence');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns empty list when no evidence exists', async () => {
      const user = await createUser({ role: UserRole.FORENSIC_ANALYST });
      const token = generateAuthToken(user._id.toString(), UserRole.FORENSIC_ANALYST);

      const res = await request(app)
        .get('/api/v1/evidence')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it('returns paginated evidence list', async () => {
      const user = await createUser({ role: UserRole.FORENSIC_ANALYST });
      const token = generateAuthToken(user._id.toString(), UserRole.FORENSIC_ANALYST);

      await createEvidence({ name: 'file1.txt' });
      await createEvidence({ name: 'file2.txt' });

      const res = await request(app)
        .get('/api/v1/evidence')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBe(2);
    });
  });

  describe('GET /api/v1/evidence/:id', () => {
    it('returns 404 for non-existent evidence', async () => {
      const user = await createUser({ role: UserRole.FORENSIC_ANALYST });
      const token = generateAuthToken(user._id.toString(), UserRole.FORENSIC_ANALYST);

      const res = await request(app)
        .get('/api/v1/evidence/000000000000000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('returns evidence by id', async () => {
      const user = await createUser({ role: UserRole.FORENSIC_ANALYST });
      const token = generateAuthToken(user._id.toString(), UserRole.FORENSIC_ANALYST);

      const evidence = await createEvidence({ name: 'test-file.txt' });

      const res = await request(app)
        .get(`/api/v1/evidence/${evidence._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.evidence.name).toBe('test-file.txt');
    });
  });

  describe('GET /api/v1/evidence/investigation/:investigationId', () => {
    it('returns evidence for an investigation', async () => {
      const user = await createUser({ role: UserRole.FORENSIC_ANALYST });
      const token = generateAuthToken(user._id.toString(), UserRole.FORENSIC_ANALYST);

      const inv = await createInvestigation();
      await createEvidence({ name: 'inv-file.txt', investigationId: inv._id });
      await createEvidence({ name: 'other.txt' });

      const res = await request(app)
        .get(`/api/v1/evidence/investigation/${inv._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('inv-file.txt');
    });
  });
});
