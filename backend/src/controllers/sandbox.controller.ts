/**
 * Sandbox Controller
 * Handles sandbox synchronization and runtime control endpoints
 */

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger';
import { sandboxSyncService, sandboxRuntimeService, aiAnalysisService, evidenceService, analysisService } from '../services';
import { AuthenticatedRequest } from '../middleware';
import { ApiResponse, EvidenceType, SandboxSessionStatus } from '../types';
import { websocketService } from '../services/websocket.service';
import { SandboxSession, Evidence } from '../models';

const SIMULATOR_DISPLAY_NAMES: Record<string, string> = {
  'system-service-alpha': 'LockByte',
  'system-service-beta': 'HiveMind',
  'system-service-gamma': 'VaultDrain',
  'system-service-delta': 'SilentEye',
  'system-service-epsilon': 'GhostKernel',
  'system-service-lateral': 'NetWarp',
  'system_service_1': 'LockByte',
  'system_service_2': 'HiveMind',
  'system_service_3': 'VaultDrain',
  'system_service_4': 'SilentEye',
  'system_service_5': 'GhostKernel',
  'ransomware-simulator': 'LockByte',
  'spyware-simulator': 'SilentEye',
  'trojan-simulator': 'Wraith',
  'botnet-simulator': 'HiveMind',
  'credential-stealer': 'VaultDrain',
};

function formatSimulatorName(simulatorId: string): string {
  return SIMULATOR_DISPLAY_NAMES[simulatorId] || simulatorId;
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
   *
   * Evidence-driven workflow:
   *   - Pass `evidenceId` to analyze an evidence artifact.
   *   - executable evidence -> simulator is auto-selected from the
   *     evidence's `simulatorHint` (chosen at registration).
   *   - document / url evidence -> static + AI analysis pipeline runs and is
   *     recorded as a completed sandbox session of the matching `kind`.
   *   - Without `evidenceId`, `simulator_id` starts a session directly
   *     (legacy behavior preserved).
   */
  async startSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { simulator_id, auto_rollback = true, timeout_seconds = 300, evidenceId } = req.body;

      let resolvedEvidence: any = null;
      let kind: 'executable' | 'document' | 'url' = 'executable';
      let resolvedSimulatorId = simulator_id;

      if (evidenceId) {
        resolvedEvidence = await Evidence.findById(evidenceId);
        if (!resolvedEvidence) {
          res.status(404).json({
            success: false,
            message: 'Evidence not found',
          });
          return;
        }

        if (resolvedEvidence.type === EvidenceType.DOCUMENT) {
          kind = 'document';
        } else if (resolvedEvidence.type === EvidenceType.URL) {
          kind = 'url';
        } else {
          kind = 'executable';
        }

        // Guard: an evidence artifact is analyzed exactly once
        const existingAnalysis = await SandboxSession.findOne({
          evidenceId: resolvedEvidence._id,
          status: SandboxSessionStatus.COMPLETED,
        });
        if (existingAnalysis) {
          res.status(409).json({
            success: false,
            message: `Evidence has already been analyzed (session ${existingAnalysis.sessionId})`,
          });
          return;
        }

        // Auto-select the simulator from the evidence for executables
        if (kind === 'executable') {
          resolvedSimulatorId = resolvedEvidence.simulatorHint || resolvedSimulatorId;
        }
      }

      if (kind === 'executable' && !resolvedSimulatorId) {
        res.status(400).json({
          success: false,
          message: 'simulator_id is required (or provide evidenceId with a simulatorHint)',
        });
        return;
      }

      // ─── Document / URL evidence: static + AI analysis session ──────────
      if (kind === 'document' || kind === 'url') {
        const analysis = kind === 'document'
          ? await analysisService.analyzeDocument(resolvedEvidence.filePath, resolvedEvidence.fileName, {
              investigationId: resolvedEvidence.investigationId?.toString(),
              evidenceId: resolvedEvidence._id?.toString(),
            })
          : await analysisService.analyzeUrl(resolvedEvidence.url, {
              investigationId: resolvedEvidence.investigationId?.toString(),
              evidenceId: resolvedEvidence._id?.toString(),
            });

        const sessionId = `ANL-${uuidv4()}`;
        const now = new Date();

        const session = await SandboxSession.create({
          sessionId,
          evidenceId: resolvedEvidence._id,
          kind,
          vmName: 'n/a — static analysis',
          simulatorId: kind,
          simulatorName: kind === 'document' ? 'Document Analysis' : 'URL Analysis',
          status: SandboxSessionStatus.COMPLETED,
          startTime: now,
          endTime: now,
          eventsCollected: 0,
          executionSummary: {
            simulatorId: kind,
            simulatorName: kind === 'document' ? 'Document Analysis' : 'URL Analysis',
            startTime: now,
            endTime: now,
            exitCode: 0,
            duration: 0,
            eventsCollected: 0,
            findings: analysis.findings || [],
            iocIndicators: analysis.extractedIocs || analysis.indicators || [],
            artifacts: [],
            syncedAt: now,
          },
          aiAnalysis: {
            session_id: sessionId,
            analysis_timestamp: now,
            total_events: 0,
            suspicious_events: (analysis.findings || []).length,
            threat_classification: {
              category: analysis.predicted_threat || 'unknown',
              family: null,
              severity: analysis.threat_level || 'unknown',
            },
            severity_score: analysis.threat_score || 0,
            severity_level: analysis.threat_level || 'unknown',
            anomalies: (analysis.findings || []).slice(0, 10).map((f: any, i: number) => ({
              type: f.type || 'finding',
              description: f.description || f.detail || '',
              severity: 'medium',
              deviation_score: 0,
            })),
            behavioral_summary: analysis.summary || '',
            recommendations: analysis.recommendations || [],
            confidence: analysis.confidence || 0,
          },
          rollbackStatus: { completed: true, success: true },
          syncedAt: now,
        });

        // Record custody + integrity verification on the evidence
        try {
          await evidenceService.addChainOfCustody(
            resolvedEvidence._id,
            'analysis_completed',
            req.user?.id || 'system',
            `${kind === 'document' ? 'Document' : 'URL'} analysis completed (session ${sessionId}) — threat level: ${analysis.threat_level || 'unknown'}`
          );
          const verify = await evidenceService.verifyIntegrity(resolvedEvidence._id);
          await evidenceService.addChainOfCustody(
            resolvedEvidence._id,
            'integrity_checked',
            req.user?.id || 'system',
            `Post-analysis integrity verification: ${verify.verified ? 'verified — evidence unchanged' : 'MODIFIED — evidence tampered during analysis'}`
          );
        } catch (custodyErr) {
          logger.warn(`[Sandbox] Failed to record custody/verification for evidence ${resolvedEvidence._id}:`, custodyErr);
        }

        // Mark the evidence record as analyzed and attach the AI result
        try {
          await Evidence.updateOne(
            { _id: resolvedEvidence._id },
            { $set: { analysisCompleted: true, aiAnalysis: session.aiAnalysis } }
          );
        } catch (evidenceErr) {
          logger.warn(`[Sandbox] Failed to update evidence analysis state for ${resolvedEvidence._id}:`, evidenceErr);
        }

        websocketService.emitSandboxSessionUpdate(session.sessionId, session);
        websocketService.emitAIAnalysisComplete(session.sessionId, session.aiAnalysis);

        const response: ApiResponse = {
          success: true,
          message: kind === 'document' ? 'Document analysis session completed' : 'URL analysis session completed',
          data: { session },
        };
        res.status(201).json(response);
        return;
      }

      // ─── Executable evidence: VM sandbox session ────────────────────────
      const runtimeSession = await sandboxRuntimeService.startSession({
        simulator_id: resolvedSimulatorId,
        auto_rollback,
        timeout_seconds,
      });

      await sandboxSyncService.receiveSessionStart({
        sessionId: runtimeSession.session_id,
        vmName: 'sandbox-vm',
        simulatorId: runtimeSession.simulator_id,
        simulatorName: formatSimulatorName(runtimeSession.simulator_id),
        startTime: runtimeSession.created_at,
        evidenceId: resolvedEvidence?._id,
        kind,
      });

      if (resolvedEvidence) {
        await evidenceService.addChainOfCustody(
          resolvedEvidence._id,
          'analysis_started',
          req.user?.id || 'system',
          `Sandbox session ${runtimeSession.session_id} started (${formatSimulatorName(runtimeSession.simulator_id)})`
        ).catch((err: any) => logger.warn(`[Sandbox] Failed to record custody start for evidence ${resolvedEvidence._id}:`, err));
      }

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

            if (status === SandboxSessionStatus.COMPLETED) {
              try {
                await sandboxSyncService.registerSandboxReportOnBlockchain(completedSession.session_id, req.user?.id || 'system');
              } catch (blockchainErr) {
                logger.warn(`Failed to auto-register sandbox report on blockchain for ${completedSession.session_id}:`, blockchainErr);
              }

              // Auto-run AI microservice analysis on session events
              let analysisResult: any = null;
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

              // Post-analysis evidence verification: prove the sandbox did not
              // alter the original artifact. Recorded in the custody chain.
              if (resolvedEvidence) {
                try {
                  await evidenceService.addChainOfCustody(
                    resolvedEvidence._id,
                    'analysis_completed',
                    req.user?.id || 'system',
                    `Sandbox session ${completedSession.session_id} completed (${formatSimulatorName(resolvedSimulatorId)})`
                  );
                  const verify = await evidenceService.verifyIntegrity(resolvedEvidence._id);
                  await evidenceService.addChainOfCustody(
                    resolvedEvidence._id,
                    'integrity_checked',
                    req.user?.id || 'system',
                    `Post-analysis integrity verification: ${verify.verified ? 'verified — evidence unchanged' : 'MODIFIED — evidence tampered during analysis'}`
                  );

                  // Mark the evidence record as analyzed and attach the AI result
                  const sessionRecord = await SandboxSession.findOne({
                    sessionId: completedSession.session_id,
                  }).lean();
                  const sessionAnalysis = sessionRecord?.aiAnalysis;
                  await Evidence.updateOne(
                    { _id: resolvedEvidence._id },
                    {
                      $set: {
                        analysisCompleted: true,
                        ...(analysisResult || sessionAnalysis
                          ? { aiAnalysis: analysisResult || sessionAnalysis }
                          : {}),
                      },
                    }
                  );
                } catch (verifyErr) {
                  logger.warn(`[Sandbox] Post-analysis verification failed for evidence ${resolvedEvidence._id}:`, verifyErr);
                }
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
      res.status(error.statusCode || 500).json({
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
    const { page = 1, limit = 20, status, investigationId } = req.query as Record<string, any>;

    const result = await sandboxSyncService.findAll({
      page: Number(page),
      limit: Math.min(Number(limit), 100),
      status,
      investigationId,
    });

    const sessions = result.sessions.map((session: any) => ({
      ...session,
      simulatorName: formatSimulatorName(
        session.simulatorId || session.simulator_id || session.simulator
      ),
    }));

    const response: ApiResponse = {
      success: true,
      message: 'Sessions retrieved',
      data: sessions,
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

    const enriched = session
      ? {
          ...session,
          simulatorName: formatSimulatorName(
            session.simulatorId || session.simulator_id || session.simulator
          ),
        }
      : session;

    const response: ApiResponse = {
      success: true,
      message: 'Session retrieved',
      data: { session: enriched },
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
      res.status(error.statusCode || 500).json({
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
      res.status(error.statusCode || 500).json({
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
      const data = await sandboxSyncService.getSessionMonitoring(req.params.sessionId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
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
      const aiAnalysis = await sandboxSyncService.getSessionAIAnalysis(req.params.sessionId);

      if (aiAnalysis === null) {
        res.status(404).json({ success: false, message: 'Session not found' });
        return;
      }

      res.json({
        success: true,
        data: { aiAnalysis },
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
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
      res.status(error.statusCode || 500).json({
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
      res.status(error.statusCode || 500).json({
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
      res.status(error.statusCode || 500).json({
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
      res.status(error.statusCode || 500).json({
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
      res.status(error.statusCode || 500).json({
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

    try {
      const result = await sandboxRuntimeService.startRuntime();
      res.json({
        success: true,
        message: 'Sandbox runtime starting on port 8765...',
        logFile: result.logFile,
        pythonPath: result.pythonPath,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start sandbox runtime',
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
