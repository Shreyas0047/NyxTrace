import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/user.model';
import { Investigation } from '../models/investigation.model';
import { Evidence } from '../models/evidence.model';
import { Alert } from '../models/alert.model';
import { SandboxSession } from '../models/sandbox-session.model';
import { TelemetryEvent } from '../models/telemetry-event.model';
import { UserRole } from '../types';

export async function createUser(overrides: Partial<Record<string, any>> = {}) {
  const password = await bcrypt.hash(overrides.password || 'Password123!', 10);
  return User.create({
    email: 'test@example.com',
    password,
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.FORENSIC_ANALYST,
    isVerified: true,
    ...overrides,
  });
}

export async function createInvestigation(overrides: Partial<Record<string, any>> = {}) {
  return Investigation.create({
    title: 'Test Investigation',
    description: 'A test investigation',
    status: 'active',
    caseNumber: `CASE-${Date.now()}`,
    createdBy: new mongoose.Types.ObjectId(),
    ...overrides,
  });
}

export async function createEvidence(overrides: Partial<Record<string, any>> = {}) {
  const inv = await createInvestigation();
  return Evidence.create({
    evidenceId: `ev-${Date.now()}`,
    investigationId: inv._id,
    name: 'test-file.txt',
    fileName: 'test-file.txt',
    filePath: '/tmp/test-file.txt',
    fileSize: 1024,
    mimeType: 'text/plain',
    collectedBy: new mongoose.Types.ObjectId(),
    description: 'Test evidence file',
    ...overrides,
  });
}

export async function createAlert(overrides: Partial<Record<string, any>> = {}) {
  return Alert.create({
    title: 'Test Alert',
    description: 'A test alert',
    severity: 'medium',
    status: 'open',
    source: 'test',
    ...overrides,
  });
}

export async function createSandboxSession(overrides: Partial<Record<string, any>> = {}) {
  return SandboxSession.create({
    sessionId: `session-${Date.now()}`,
    status: 'idle',
    ...overrides,
  });
}

export async function createTelemetryEvent(overrides: Partial<Record<string, any>> = {}) {
  return TelemetryEvent.create({
    sessionId: 'test-session',
    eventType: 'process_create',
    timestamp: new Date(),
    metadata: {},
    ...overrides,
  });
}
