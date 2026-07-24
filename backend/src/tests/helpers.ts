import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserRole } from '../types';

export function createTestApp(): express.Application {
  const app = express();
  app.use(express.json());
  return app;
}

export function generateAuthToken(userId: string, role: UserRole = UserRole.FORENSIC_ANALYST): string {
  const payload = {
    userId,
    email: 'test@example.com',
    role,
  };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: '1h' });
}
