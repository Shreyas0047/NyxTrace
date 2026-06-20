/**
 * Sandbox Controller
 * Handles sandbox synchronization and runtime control endpoints
 */

import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import logger from '../config/logger';
import { sandboxSyncService, sandboxRuntimeService, aiAnalysisService } from '../services';
import { AuthenticatedRequest } from '../middleware';
import { ApiResponse, SandboxSessionStatus } from '../types';
import { websocketService } from '../services/websocket.service';
import { blockchainVerificationService } from '../blockchain';
import { SandboxSession } from '../models';
import { TelemetryEvent } from '../models/telemetry-event.model';

/**
 * Simulator display-name mapping.
 *
 * SOURCE OF TRUTH: `sandbox-agent-v2/agent/app.py` (SIMULATORS list) and
 * `sandbox-agent-v2/agent/pipeline.py` (script_map).  Keep these files in
 * sync when adding/renaming simulators.
 */
const SIMULATOR_DISPLAY_NAMES: Record<string, string> = {
  'system_service_1': 'Sample Alpha',
  'system_service_2': 'Sample Beta',
  'system_service_3': 'Sample Gamma',
  'system_service_4': 'Sample Delta',
  'system_service_5': 'Sample Epsilon',
  'ransomware-simulator': 'Sample Alpha',
  'spyware-simulator': 'Sample Beta',
  'trojan-simulator': 'Sample Gamma',
  'botnet-simulator': 'Sample Delta',
  'credential-stealer': 'Sample Epsilon',
};

function formatSimulatorName(simulatorId: string): string {
  return SIMULATOR_DISPLAY_NAMES[simulatorId] || simulatorId;
}

let runtimeStarting = false;

/**
 * Auto-register the sandbox-report.json on the blockchain after analysis completes.
 * Implements the workflow: Evidence → SHA256 → Blockchain.
 * Polls briefly for the report file (the agent writes it after COMPLETE state).
 */
async function registerSandboxReportOnBlockchain(sessionId: string, userId: string): Promise<void> {
  // Locate the sandbox-report-<sessionId>.json file
  const reportPath = path.resolve(process.cwd(), 'uploads', 'reports', `sandbox-report-${sessionId}.json`);

  // The agent writes the file just after COMPLETE; allow a brief window for the write.
  for (let attempt = 0; attempt < 5; attempt++) {
    if (fs.existsSync(reportPath)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!fs.existsSync(reportPath)) {
    logger.warn(`[Blockchain] Sandbox report not found at ${reportPath}; skipping auto-registration.`);
    return;
  }

  // Use sessionId as the evidence ID so it can be looked up later.
  const evidenceId = `SANDBOX-${sessionId}`;

  try {
    const result = await blockchainVerificationService.registerEvidence(evidenceId, reportPath, userId);
    logger.info(`[Blockchain] Auto-registered sandbox report ${evidenceId} fingerprint=${result.fingerprint.slice(0, 16)}...`);
  } catch (err) {
    logger.warn(`[Blockchain] Auto-registration failed for ${evidenceId}:`, err);
  }
}

export class SandboxController {
  /**
   * GET /api/v1/sandbox/health
   * Get sandbox runtime health status
   */
  async getHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const health = await sandboxRuntimeService.getHealth();

      const response: ApiResponse = {
        success: true,
        message: 'Sandbox runtime health retrieved',
        data: { health },
      };

      res.json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: error.message || 'Failed to get sandbox health',
        data: { status: 'unavailable' },
      };
      res.status(503).json(response);
    }
  }

  /**
   * GET /api/v1/sandbox/simulators
   * List available simulators
   */
  async listSimulators(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const simulators = await sandboxRuntimeService.listSimulators();

      const response: ApiResponse = {
        success: true,
        message: 'Simulators retrieved',
        data: { simulators },
      };

      res.json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: error.message || 'Failed to list simulators',
        data: { simulators: [] },
      };
      res.status(503).json(response);
    }
  }

  /**
   * POST /api/v1/sandbox/sessions
   * Start a new sandbox session (runtime-controlled)
   */
  async startSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { simulator_id, auto_rollback = true, timeout_seconds = 300 } = req.body;

      if (!simulator_id) {
        res.status(400).json({
          success: false,
          message: 'simulator_id is required',
        });
        return;
      }

      const runtimeSession = await sandboxRuntimeService.startSession({
        simulator_id,
        auto_rollback,
        timeout_seconds,
      });

      await sandboxSyncService.receiveSessionStart({
        sessionId: runtimeSession.session_id,
        vmName: 'sandbox-vm',
        simulatorId: runtimeSession.simulator_id,
        simulatorName: formatSimulatorName(runtimeSession.simulator_id),
        startTime: runtimeSession.created_at,
      });

      sandboxRuntimeService.monitorSessionCompletion(
        runtimeSession.session_id,
        async (completedSession) => {
          try {
            const stateMap: Record<string, SandboxSessionStatus> = {
              'COMPLETED': SandboxSessionStatus.COMPLETED,
              'FAILED': SandboxSessionStatus.FAILED,
            };
            const status = stateMap[completedSession.state.toUpperCase()] || SandboxSessionStatus.FAILED;

            await sandboxSyncService.receiveSessionComplete({
              sessionId: completedSession.session_id,
              status,
              endTime: completedSession.updated_at,
            });

            try {
              const eventsData = await sandboxRuntimeService.getSessionEvents(completedSession.session_id);
              if (eventsData.events && eventsData.events.length > 0) {
                await sandboxSyncService.receiveForensicEvents({
                  sessionId: completedSession.session_id,
                  events: eventsData.events,
                });
                logger.info(`Forwarded ${eventsData.events.length} forensic events for session ${completedSession.session_id}`);
              }
            } catch (eventsErr) {
              logger.warn(`Failed to forward events for session ${completedSession.session_id}:`, eventsErr);
            }

            // Workflow: Evidence → SHA256 → Blockchain (only after analysis completes)
            if (status === SandboxSessionStatus.COMPLETED) {
              try {
                await registerSandboxReportOnBlockchain(completedSession.session_id, req.user?.id || 'system');
              } catch (blockchainErr) {
                logger.warn(`Failed to auto-register sandbox report on blockchain for ${completedSession.session_id}:`, blockchainErr);
              }

              // Auto-run AI microservice analysis on session events
              try {
                const eventsData = await sandboxRuntimeService.getSessionEvents(completedSession.session_id);
                if (eventsData.events && eventsData.events.length > 0) {
                  const analysisResult = await aiAnalysisService.analyzeTelemetry({
                    sessionId: completedSession.session_id,
                    events: eventsData.events.map((e: any) => ({
                      timestamp: e.timestamp || new Date().toISOString(),
                      type: e.type || e.eventType || e.event_type || e.category || 'unknown',
                      source: e.source || e.processName || e.process_name || 'sandbox',
                      details: e.details || e.data || e.metadata || {},
                    })),
                  });

                  await SandboxSession.updateOne(
                    { sessionId: completedSession.session_id },
                    { $set: { aiAnalysis: analysisResult } }
                  );

                  websocketService.emitAIAnalysisComplete(completedSession.session_id, analysisResult);
                  logger.info(`[AI] Auto-analysis completed for session ${completedSession.session_id}`);
                }
              } catch (aiErr) {
                logger.warn(`[AI] Analysis failed for session ${completedSession.session_id}:`, aiErr);
              }
            }
          } catch (err) {
            logger.error(`Failed to record session completion for ${runtimeSession.session_id}:`, err);
          }
        },
      );

      websocketService.emitSandboxSessionUpdate(runtimeSession.session_id, runtimeSession);

      const response: ApiResponse = {
        success: true,
        message: 'Session started',
        data: { session: runtimeSession },
      };

      res.status(201).json(response);
    } catch (error: any) {
      websocketService.emitSandboxError('', {
        code: error.code || 'START_FAILED',
        message: error.message || 'Failed to start session',
        stage: 'START',
      });
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to start session',
      });
    }
  }

  /**
   * GET /api/v1/sessions
   * List all sessions (from MongoDB)
   */
  async findAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { page = 1, limit = 20, status } = req.query as Record<string, any>;

    const result = await sandboxSyncService.findAll({
      page: Number(page),
      limit: Math.min(Number(limit), 100),
      status,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Sessions retrieved',
      data: result.sessions,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total: result.total,
        totalPages: result.totalPages,
      },
    };

    res.json(response);
  }

  /**
   * GET /api/v1/sandbox/sessions/:sessionId
   * Get session by ID
   */
  async findById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const session = await sandboxSyncService.findById(req.params.sessionId);

    const response: ApiResponse = {
      success: true,
      message: 'Session retrieved',
      data: { session },
    };

    res.json(response);
  }

  /**
   * POST /api/v1/sandbox/sessions/:sessionId/stop
   * Stop an active session
   */
  async stopSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const runtimeSession = await sandboxRuntimeService.stopSession(req.params.sessionId);

      // Fetch and persist events before marking session complete
      try {
        const eventsData = await sandboxRuntimeService.getSessionEvents(req.params.sessionId);
        if (eventsData.events && eventsData.events.length > 0) {
          await sandboxSyncService.receiveForensicEvents({
            sessionId: req.params.sessionId,
            events: eventsData.events,
          });
        }
      } catch (eventsErr) {
        logger.warn(`Failed to forward events on stop for session ${req.params.sessionId}:`, eventsErr);
      }

      await sandboxSyncService.receiveSessionComplete({
        sessionId: runtimeSession.session_id,
        status: 'failed' as any,
        endTime: runtimeSession.updated_at,
        exitCode: -1,
        errors: [runtimeSession.error || 'Session stopped by user'],
      });

      websocketService.emitSandboxSessionUpdate(runtimeSession.session_id, runtimeSession);

      const response: ApiResponse = {
        success: true,
        message: 'Session stopped',
        data: { session: runtimeSession },
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to stop session',
      });
    }
  }

  /**
   * POST /api/v1/sandbox/sessions/:sessionId/terminate
   * Force terminate an active session with rollback
   */
  async terminateSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Fetch and persist events before terminating
      try {
        const eventsData = await sandboxRuntimeService.getSessionEvents(req.params.sessionId);
        if (eventsData.events && eventsData.events.length > 0) {
          await sandboxSyncService.receiveForensicEvents({
            sessionId: req.params.sessionId,
            events: eventsData.events,
          });
        }
      } catch (eventsErr) {
        logger.warn(`Failed to forward events on terminate for session ${req.params.sessionId}:`, eventsErr);
      }

      const runtimeSession = await sandboxRuntimeService.terminateSession(req.params.sessionId);

      await sandboxSyncService.receiveSessionComplete({
        sessionId: runtimeSession.session_id,
        status: 'failed' as any,
        endTime: runtimeSession.updated_at,
        exitCode: -1,
        errors: [runtimeSession.error || 'Session terminated by user'],
      });

      websocketService.emitSandboxSessionUpdate(runtimeSession.session_id, runtimeSession);

      const response: ApiResponse = {
        success: true,
        message: 'Session terminated',
        data: { session: runtimeSession },
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to terminate session',
      });
    }
  }

  /**
   * GET /api/v1/sandbox/stats
   * Get sandbox statistics
   */
  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    const stats = await sandboxSyncService.getStats();

    const response: ApiResponse = {
      success: true,
      message: 'Statistics retrieved',
      data: { stats },
    };

    res.json(response);
  }

  /**
   * DELETE /api/v1/sandbox/sessions
   * Clear all session history
   */
  async clearSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await sandboxSyncService.clearAll();
    res.json({ success: true, message: 'Sessions cleared', data: result });
  }

  /**
   * GET /api/v1/sandbox/telemetry-url
   * Get WebSocket URL for telemetry streaming
   */
  async getTelemetryUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    const url = sandboxRuntimeService.getTelemetryUrl();

    const response: ApiResponse = {
      success: true,
      message: 'Telemetry URL retrieved',
      data: { url },
    };

    res.json(response);
  }

  /**
   * GET /api/v1/sandbox/logs-url
   * Get WebSocket URL for system log streaming
   */
  async getLogsUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    const url = sandboxRuntimeService.getLogsUrl();

    const response: ApiResponse = {
      success: true,
      message: 'System logs URL retrieved',
      data: { url },
    };

    res.json(response);
  }

  /**
   * GET /api/v1/sandbox/sessions/:sessionId/monitoring
   * Get persisted monitoring summary for a completed session
   */
  async getSessionMonitoring(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const events = await TelemetryEvent.find({ sessionId: req.params.sessionId }).lean();

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

      res.json({
        success: true,
        data: {
          sessionId: req.params.sessionId,
          totalEvents: events.length,
          ...counts,
          severityCounts,
          suspiciousActivities: suspicious.slice(0, 50),
          isActive: false,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get session monitoring data',
      });
    }
  }

  /**
   * GET /api/v1/sandbox/sessions/:sessionId/ai-analysis
   * Get persisted AI analysis result for a completed session
   */
  async getSessionAIAnalysis(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const session = await SandboxSession.findOne({ sessionId: req.params.sessionId })
        .select('sessionId aiAnalysis')
        .lean();

      if (!session) {
        res.status(404).json({ success: false, message: 'Session not found' });
        return;
      }

      res.json({
        success: true,
        data: { aiAnalysis: (session as any).aiAnalysis || null },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get AI analysis',
      });
    }
  }

  /**
   * POST /api/v1/sandbox/vm/reset
   * Reset VM to clean snapshot
   */
  async resetVm(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await sandboxRuntimeService.resetVm();

      const response: ApiResponse = {
        success: true,
        message: 'VM reset',
        data: result,
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to reset VM',
      });
    }
  }

  /**
   * GET /api/v1/sandbox/vm/status
   * Get VM status
   */
  async getVmStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const status = await sandboxRuntimeService.getVmStatus();

      const response: ApiResponse = {
        success: true,
        message: 'VM status retrieved',
        data: { status },
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get VM status',
      });
    }
  }

  /**
   * GET /api/v1/sandbox/monitoring/status
   * Get monitoring status
   */
  async getMonitoringStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const status = await sandboxRuntimeService.getMonitoringStatus();

      const response: ApiResponse = {
        success: true,
        message: 'Monitoring status retrieved',
        data: { status },
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get monitoring status',
      });
    }
  }

  /**
   * GET /api/v1/sandbox/execution/status
   * Get execution status
   */
  async getExecutionStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const status = await sandboxRuntimeService.getExecutionStatus();

      const response: ApiResponse = {
        success: true,
        message: 'Execution status retrieved',
        data: { status },
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get execution status',
      });
    }
  }

  /**
   * GET /api/v1/sandbox/logs
   * Get runtime logs
   */
  async getLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { limit = 100, level } = req.query as Record<string, any>;
      const logs = await sandboxRuntimeService.getLogs(
        Number(limit) || 100,
        level as string
      );

      const response: ApiResponse = {
        success: true,
        message: 'Logs retrieved',
        data: logs,
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get logs',
      });
    }
  }

  /**
   * POST /api/v1/sandbox/runtime/start
   * Start the sandbox runtime service
   */
   async startRuntime(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (runtimeStarting) {
      res.status(409).json({
        success: false,
        message: 'Runtime is already starting. Please wait.',
      });
      return;
    }

    try {
      const isRunning = await sandboxRuntimeService.isAvailable();
      if (isRunning) {
        res.json({
          success: true,
          message: 'Sandbox runtime is already running',
        });
        return;
      }
    } catch {
      // Runtime not available, proceed to start
    }

    const { spawn, exec } = await import('child_process');
    const { join, dirname } = await import('path');
    const fs = await import('fs');
    const util = await import('util');
    const execPromise = util.promisify(exec);

    // Resolve project root: if SANDBOX_PROJECT_ROOT is set use it,
    // else walk up from cwd to find the directory containing 'sandbox-agent-v2'
    let projectRoot = process.env.SANDBOX_PROJECT_ROOT || process.cwd();
    if (!fs.existsSync(join(projectRoot, 'sandbox-agent-v2'))) {
      // Walk up directories looking for the sandbox-agent-v2 folder
      let candidate = process.cwd();
      for (let i = 0; i < 5; i++) {
        if (fs.existsSync(join(candidate, 'sandbox-agent-v2'))) {
          projectRoot = candidate;
          break;
        }
        const parent = dirname(candidate);
        if (parent === candidate) break;
        candidate = parent;
      }
    }
    const runtimeFilePath = join(projectRoot, 'sandbox-agent-v2', 'main.py');

    if (!fs.existsSync(runtimeFilePath)) {
      res.status(404).json({
        success: false,
        message: `Runtime script not found at: ${runtimeFilePath}`,
      });
      return;
    }

    let pythonPath: string | null = null;

    const isWin = process.platform === 'win32';
    const pythonCandidates = [
      process.env.PYTHON_PATH,
      'python3',
      'python',
      ...(isWin ? ['py'] : []),
    ].filter(Boolean) as string[];

    for (const candidate of pythonCandidates) {
      if (!candidate) continue;
      if (candidate.includes('\\') || candidate.includes('/')) {
        if (fs.existsSync(candidate)) {
          pythonPath = candidate;
          break;
        }
      } else {
        try {
          const whichCmd = isWin ? 'where' : 'command -v';
          const { stdout } = await execPromise(`${whichCmd} ${candidate}`);
          const path = stdout.trim().split('\n')[0];
          if (path) {
            pythonPath = path;
            break;
          }
        } catch {
          continue;
        }
      }
    }

    if (!pythonPath) {
      res.status(500).json({
        success: false,
        message: 'Python not found. Install Python 3.11+ and add to PATH, or set PYTHON_PATH environment variable.',
        searched: pythonCandidates.filter(Boolean),
      });
      return;
    }

    try {
      runtimeStarting = true;
      const logDir = join(projectRoot, 'sandbox-agent-v2');
      const logFile = join(logDir, 'runtime.log');

      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      try {
        if (isWin) {
          const { stdout: netstatOut } = await execPromise('netstat -ano | findstr :8765');
          const lines = netstatOut.trim().split('\n').filter(l => l.includes('LISTENING'));
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
              try {
                await execPromise(`taskkill /F /PID ${pid}`);
              } catch { /* process may already be dead */ }
            }
          }
        } else {
          try {
            await execPromise('lsof -ti :8765 | xargs -r kill -9');
          } catch { /* port not in use */ }
        }
      } catch { /* port detection failed — may not be in use */ }

      // Open log file as file descriptor so child can write to it independently of parent
      const logFd = fs.openSync(logFile, 'a');

      const child = spawn(pythonPath, [
        '-u', runtimeFilePath,
      ], {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        cwd: join(projectRoot, 'sandbox-agent-v2'),
        env: { ...process.env, PYTHONPATH: join(projectRoot, 'sandbox-agent-v2') },
        ...(isWin ? { windowsHide: true } : {}),
      });

      // Close parent's fd; child has its own copy now
      fs.closeSync(logFd);

      child.unref();

      child.on('error', (err) => {
        runtimeStarting = false;
        logger.error(`[Sandbox] Runtime spawn error: ${err.message}`);
      });

      child.on('exit', (code) => {
        runtimeStarting = false;
        logger.info(`[Sandbox] Runtime exited with code ${code}`);
      });

      setTimeout(() => {
        runtimeStarting = false;
      }, 10000);

      res.json({
        success: true,
        message: 'Sandbox runtime starting on port 8765...',
        logFile,
        pythonPath,
      });
    } catch (error) {
      runtimeStarting = false;
      res.status(500).json({
        success: false,
        message: 'Failed to start sandbox runtime',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/sandbox/sessions/start
   * Legacy: Receive session start event from desktop agent
   */
  async receiveSessionStart(req: AuthenticatedRequest, res: Response): Promise<void> {
    const session = await sandboxSyncService.receiveSessionStart(req.body);

    const response: ApiResponse = {
      success: true,
      message: 'Session started',
      data: { session },
    };

    res.status(201).json(response);
  }

  /**
   * POST /api/v1/sandbox/sessions/:sessionId/complete
   * Legacy: Receive session completion event
   */
  async receiveSessionComplete(req: AuthenticatedRequest, res: Response): Promise<void> {
    const session = await sandboxSyncService.receiveSessionComplete({
      ...req.body,
      sessionId: req.params.sessionId,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Session completed',
      data: { session },
    };

    res.json(response);
  }

  /**
   * POST /api/v1/sandbox/sessions/:sessionId/events
   * Legacy: Receive forensic events from sandbox
   */
  async receiveEvents(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await sandboxSyncService.receiveForensicEvents({
      ...req.body,
      sessionId: req.params.sessionId,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Events received',
      data: result,
    };

    res.json(response);
  }

}

export const sandboxController = new SandboxController();
export default sandboxController;
