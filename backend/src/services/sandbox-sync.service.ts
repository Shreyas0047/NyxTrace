/**
 * Sandbox Synchronization Service
 * Handles data sync from desktop sandbox agent
 */

import path from 'path';
import fs from 'fs';
import logger from '../config/logger';
import { SandboxSession, Evidence } from '../models';
import { TelemetryEvent } from '../models/telemetry-event.model';
import { SandboxSessionStatus } from '../types';
import { ConflictError, AppError } from '../middleware';
import { websocketService } from './websocket.service';
// import { v4 as uuidv4 } from 'uuid';

export class SandboxSyncService {
  /**
   * Receive sandbox session start event
   */
  async receiveSessionStart(data: {
    sessionId: string;
    vmName: string;
    simulatorId: string;
    simulatorName: string;
    startTime: string;
    evidenceId?: string;
    kind?: 'executable' | 'document' | 'url';
  }): Promise<any> {
    // Check for duplicate session
    const existing = await SandboxSession.findOne({ sessionId: data.sessionId });
    if (existing) {
      throw new ConflictError(`Session ${data.sessionId} already exists`);
    }

    const session = await SandboxSession.create({
      sessionId: data.sessionId,
      vmName: data.vmName,
      simulatorId: data.simulatorId,
      simulatorName: data.simulatorName,
      status: SandboxSessionStatus.RUNNING,
      startTime: new Date(data.startTime),
      ...(data.evidenceId ? { evidenceId: data.evidenceId, kind: data.kind || 'executable' } : {}),
    });

    websocketService.emitSandboxSessionUpdate(session.sessionId, session);
    return session;
  }

  /**
   * Receive sandbox session completion
   */
  async receiveSessionComplete(data: {
    sessionId: string;
    status: SandboxSessionStatus;
    endTime: string;
    exitCode?: number;
    eventsCollected?: number;
    evidenceFiles?: string[];
    errors?: string[];
  }): Promise<any> {
    const session = await SandboxSession.findOne({ sessionId: data.sessionId });
    if (!session) {
      throw new AppError('Session not found', 400, 'NOT_FOUND');
    }

    session.status = data.status;
    session.endTime = new Date(data.endTime);
    session.duration = (session.endTime.getTime() - session.startTime.getTime()) / 1000;
    session.exitCode = data.exitCode;
    session.eventsCollected = data.eventsCollected || 0;
    session.evidenceFiles = data.evidenceFiles || [];
    session.errorMessages = data.errors || [];
    session.syncedAt = new Date();

    await session.save();
    websocketService.emitSandboxSessionUpdate(session.sessionId, session);
    return session;
  }

  /**
   * Receive forensic events from sandbox
   */
  async receiveForensicEvents(data: {
    sessionId: string;
    events: Array<{
      timestamp: string;
      type: string;
      source: string;
      details: Record<string, any>;
    }>;
  }): Promise<{ received: number }> {
    // Verify session exists
    const session = await SandboxSession.findOne({ sessionId: data.sessionId });
    if (!session) {
      throw new AppError('Session not found', 400, 'NOT_FOUND');
    }

    const normalizedEvents = data.events.map((event: any, index) => ({
      sessionId: data.sessionId,
      eventType: event.type || event.eventType || event.event_type || event.category || 'unknown',
      timestamp: new Date(event.timestamp || Date.now()),
      processId: event.processId || event.process_id || event.pid,
      processName: event.processName || event.process_name || event.source_process || event.source,
      metadata: event.details || event.data || event.metadata || {},
      raw: event,
    }));

    if (normalizedEvents.length > 0) {
      await TelemetryEvent.insertMany(normalizedEvents, { ordered: false });
    }

    session.eventsCollected += normalizedEvents.length;
    (session as any).recentEvents = [
      ...((session as any).recentEvents || []),
      ...data.events.map((event: any, index) => ({
        id: event.id || `${data.sessionId}-${Date.now()}-${index}`,
        timestamp: event.timestamp || new Date().toISOString(),
        type: event.type || event.eventType || event.event_type || event.category || 'unknown',
        source: event.source || event.processName || event.process_name || 'sandbox',
        details: event.details || event.data || event.metadata || {},
        receivedAt: new Date(),
      })),
    ].slice(-200);
    await session.save();
    websocketService.emitSandboxTelemetry(data.sessionId, { received: normalizedEvents.length });
    return { received: normalizedEvents.length };
  }

  /**
   * Get all sessions
   */
  async findAll(options: {
    page: number;
    limit: number;
    status?: SandboxSessionStatus;
    investigationId?: string;
  }): Promise<{ sessions: any[]; total: number; totalPages: number }> {
    const { page, limit, status, investigationId } = options;

    const query: any = status ? { status } : {};
    if (investigationId) {
      const evidenceIds = await Evidence.find({ investigationId }).distinct('_id');
      query.evidenceId = { $in: evidenceIds };
    }

    const total = await SandboxSession.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const sessions = await SandboxSession.find(query)
      .sort({ startTime: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return { sessions, total, totalPages };
  }

  /**
   * Get session by ID
   */
  async findById(sessionId: string): Promise<any> {
    const session = await SandboxSession.findOne({ sessionId }).lean();
    if (!session) {
      throw new AppError('Session not found', 400, 'NOT_FOUND');
    }
    return session;
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    avgDuration: number;
  }> {
    const total = await SandboxSession.countDocuments();

    const byStatus = await SandboxSession.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const avgDuration = await SandboxSession.aggregate([
      { $match: { duration: { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$duration' } } },
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
      avgDuration: avgDuration[0]?.avg || 0,
    };
  }

  /**
   * Register a sandbox report on the blockchain after analysis completes.
   * Implements: Evidence → SHA256 → Blockchain.
   */
  async registerSandboxReportOnBlockchain(sessionId: string, userId: string): Promise<void> {
    const reportPath = path.resolve(process.cwd(), 'uploads', 'reports', `sandbox-report-${sessionId}.json`);

    for (let attempt = 0; attempt < 5; attempt++) {
      if (fs.existsSync(reportPath)) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!fs.existsSync(reportPath)) {
      logger.warn(`[Blockchain] Sandbox report not found at ${reportPath}; skipping auto-registration.`);
      return;
    }

    const evidenceId = `SANDBOX-${sessionId}`;

    try {
      const { blockchainVerificationService } = await import('../blockchain');
      const result = await blockchainVerificationService.registerEvidence(evidenceId, reportPath, userId);
      logger.info(`[Blockchain] Auto-registered sandbox report ${evidenceId} fingerprint=${result.fingerprint.slice(0, 16)}...`);
    } catch (err) {
      logger.warn(`[Blockchain] Auto-registration failed for ${evidenceId}:`, err);
    }
  }

  /**
   * Get session monitoring summary with categorized event counts
   */
  async getSessionMonitoring(sessionId: string): Promise<{
    sessionId: string;
    totalEvents: number;
    process: number;
    file: number;
    registry: number;
    network: number;
    credential: number;
    severityCounts: Record<string, number>;
    suspiciousActivities: any[];
    isActive: boolean;
  }> {
    const events = await TelemetryEvent.find({ sessionId }).lean();

    const counts: Record<string, number> = { process: 0, file: 0, registry: 0, network: 0, credential: 0 };
    const severityCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const suspicious: any[] = [];

    for (const e of events) {
      const text = `${e.eventType || ''} ${JSON.stringify(e.metadata || {})}`.toLowerCase();
      const cat =
        text.includes('registry') ? 'registry' :
        text.includes('network') || text.includes('connect') || text.includes('dns') ? 'network' :
        text.includes('credential') || text.includes('password') || text.includes('lsass') ? 'credential' :
        text.includes('file') || text.includes('write') || text.includes('delete') || text.includes('encrypt') ? 'file' :
        'process';
      counts[cat] = (counts[cat] || 0) + 1;
      const sev = (e as any).severity || 'info';
      severityCounts[sev] = (severityCounts[sev] || 0) + 1;
      if (sev === 'critical' || sev === 'high') suspicious.push(e);
    }

    return {
      sessionId,
      totalEvents: events.length,
      process: counts.process,
      file: counts.file,
      registry: counts.registry,
      network: counts.network,
      credential: counts.credential,
      severityCounts,
      suspiciousActivities: suspicious.slice(0, 50),
      isActive: false,
    };
  }

  /**
   * Get persisted AI analysis result for a completed session
   */
  async getSessionAIAnalysis(sessionId: string): Promise<any> {
    const session = await SandboxSession.findOne({ sessionId })
      .select('sessionId aiAnalysis')
      .lean();

    if (!session) {
      return null;
    }

    return (session as any).aiAnalysis || null;
  }

  /**
   * Clear all sessions
   */
  async clearAll(): Promise<{ deleted: number }> {
    const result = await SandboxSession.deleteMany({});
    await TelemetryEvent.deleteMany({});
    return { deleted: result.deletedCount || 0 };
  }
}

export const sandboxSyncService = new SandboxSyncService();
export default sandboxSyncService;
