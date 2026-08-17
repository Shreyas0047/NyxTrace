import '../setup';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../index';
import { generateAuthToken } from '../helpers';
import { createUser } from '../factories';
import { User } from '../../models';
import { UserRole } from '../../types';

describe('User Routes', () => {
  describe('PUT /api/v1/users/:id', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).put('/api/v1/users/000000000000000000000000');
      expect(res.status).toBe(401);
    });

    it('updates name, department and role when performed by a super admin', async () => {
      const target = await createUser({
        email: 'analyst@example.com',
        firstName: 'Old',
        lastName: 'Name',
        role: UserRole.FORENSIC_ANALYST,
      });
      const admin = await createUser({ role: UserRole.SUPER_ADMIN, email: 'admin@example.com' });
      const token = generateAuthToken(admin._id.toString(), UserRole.SUPER_ADMIN);

      const res = await request(app)
        .put(`/api/v1/users/${target._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Jane Doe',
          department: 'Digital Forensics',
          role: UserRole.AUDITOR,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await User.findById(target._id);
      expect(updated!.firstName).toBe('Jane');
      expect(updated!.lastName).toBe('Doe');
      expect(updated!.department).toBe('Digital Forensics');
      expect(updated!.role).toBe(UserRole.AUDITOR);
    });

    it('splits a single-word name into firstName and keeps lastName present', async () => {
      const target = await createUser({ email: 'single@example.com', role: UserRole.AUDITOR });
      const admin = await createUser({ role: UserRole.SUPER_ADMIN, email: 'admin2@example.com' });
      const token = generateAuthToken(admin._id.toString(), UserRole.SUPER_ADMIN);

      const res = await request(app)
        .put(`/api/v1/users/${target._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Zed' });

      expect(res.status).toBe(200);
      const updated = await User.findById(target._id);
      expect(updated!.firstName).toBe('Zed');
      expect(updated!.lastName).toBeTruthy();
    });

    it('rejects an admin managing another admin (peer) with 403', async () => {
      const target = await createUser({ email: 'peer@example.com', role: UserRole.ADMIN });
      const admin = await createUser({ email: 'admin3@example.com', role: UserRole.ADMIN });
      const token = generateAuthToken(admin._id.toString(), UserRole.ADMIN);

      const res = await request(app)
        .put(`/api/v1/users/${target._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nope' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Cannot update this user');
    });

    it('allows an admin to update a strictly-lower user', async () => {
      const target = await createUser({
        email: 'junior@example.com',
        firstName: 'Junior',
        lastName: 'Analyst',
        role: UserRole.FORENSIC_ANALYST,
      });
      const admin = await createUser({ email: 'admin4@example.com', role: UserRole.ADMIN });
      const token = generateAuthToken(admin._id.toString(), UserRole.ADMIN);

      const res = await request(app)
        .put(`/api/v1/users/${target._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name', role: UserRole.AUDITOR });

      expect(res.status).toBe(200);
      const updated = await User.findById(target._id);
      expect(updated!.firstName).toBe('New');
      expect(updated!.role).toBe(UserRole.AUDITOR);
    });

    it('rejects assigning a role higher than the updater own role', async () => {
      const target = await createUser({ email: 'low@example.com', role: UserRole.AUDITOR });
      const admin = await createUser({ email: 'admin-role@example.com', role: UserRole.ADMIN });
      const token = generateAuthToken(admin._id.toString(), UserRole.ADMIN);

      const res = await request(app)
        .put(`/api/v1/users/${target._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: UserRole.SUPER_ADMIN });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Cannot assign this role');
    });

    it('allows a super admin to demote themselves to a lower role', async () => {
      const admin = await createUser({
        email: 'selfdemote@example.com',
        firstName: 'Self',
        lastName: 'Admin',
        role: UserRole.SUPER_ADMIN,
      });
      const token = generateAuthToken(admin._id.toString(), UserRole.SUPER_ADMIN);

      const res = await request(app)
        .put(`/api/v1/users/${admin._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: UserRole.ADMIN });

      expect(res.status).toBe(200);
      const updated = await User.findById(admin._id);
      expect(updated!.role).toBe(UserRole.ADMIN);
    });

    it('hashes a new password provided on update', async () => {
      const target = await createUser({
        email: 'pwchange@example.com',
        password: 'OldPass123!',
        role: UserRole.AUDITOR,
      });
      const admin = await createUser({ role: UserRole.SUPER_ADMIN, email: 'admin5@example.com' });
      const token = generateAuthToken(admin._id.toString(), UserRole.SUPER_ADMIN);

      const res = await request(app)
        .put(`/api/v1/users/${target._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'NewPass123!' });

      expect(res.status).toBe(200);
      const updated: any = await User.findById(target._id).select('+password');
      expect(updated.password).not.toBe('NewPass123!');
      expect(await bcrypt.compare('NewPass123!', updated.password)).toBe(true);
      expect(await bcrypt.compare('OldPass123!', updated.password)).toBe(false);
    });
  });

  describe('GET /api/v1/users', () => {
    it('includes a display name derived from firstName/lastName', async () => {
      const admin = await createUser({ email: 'admin6@example.com', role: UserRole.ADMIN });
      await createUser({ email: 'listed@example.com', firstName: 'Listed', lastName: 'User' });
      const token = generateAuthToken(admin._id.toString(), UserRole.ADMIN);

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const listed = res.body.data.users.find((u: any) => u.email === 'listed@example.com');
      expect(listed).toBeDefined();
      expect(listed.name).toBe('Listed User');
    });
  });
});
