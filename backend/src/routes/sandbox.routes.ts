/**
 * Sandbox Routes
 * /api/v1/sandbox
 */

import { Router } from 'express';
import { sandboxController } from '../controllers';
import { authenticate, authorize, asyncHandler } from '../middleware';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);

router.get(
  '/health',
  authorize(UserRole.AUDITOR, UserRole.FORENSIC_ANALYST, UserRole.SANDBOX_OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.getHealth)
);

router.get(
  '/simulators',
  authorize(UserRole.FORENSIC_ANALYST, UserRole.SANDBOX_OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.listSimulators)
);

router.post(
  '/sessions',
  authorize(UserRole.SANDBOX_OPERATOR, UserRole.FORENSIC_ANALYST, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.startSession)
);

router.get(
  '/sessions',
  authorize(UserRole.FORENSIC_ANALYST, UserRole.SECURITY_REVIEWER, UserRole.SANDBOX_OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.findAll)
);

router.get(
  '/sessions/:sessionId',
  authorize(UserRole.FORENSIC_ANALYST, UserRole.SECURITY_REVIEWER, UserRole.SANDBOX_OPERATOR, UserRole.AUDITOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.findById)
);

router.get(
  '/sessions/:sessionId/monitoring',
  authorize(UserRole.FORENSIC_ANALYST, UserRole.SECURITY_REVIEWER, UserRole.SANDBOX_OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.getSessionMonitoring)
);

router.get(
  '/sessions/:sessionId/ai-analysis',
  authorize(UserRole.FORENSIC_ANALYST, UserRole.SECURITY_REVIEWER, UserRole.SANDBOX_OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.getSessionAIAnalysis)
);

router.post(
  '/sessions/:sessionId/stop',
  authorize(UserRole.SANDBOX_OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.stopSession)
);

router.post(
  '/sessions/:sessionId/terminate',
  authorize(UserRole.SANDBOX_OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.terminateSession)
);

router.get(
  '/stats',
  authorize(UserRole.FORENSIC_ANALYST, UserRole.SECURITY_REVIEWER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.getStats)
);

router.delete(
  '/sessions',
  authorize(UserRole.SANDBOX_OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.clearSessions)
);

router.get(
  '/telemetry-url',
  authorize(UserRole.FORENSIC_ANALYST, UserRole.SANDBOX_OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.getTelemetryUrl)
);

router.get(
  '/logs-url',
  authorize(UserRole.FORENSIC_ANALYST, UserRole.SANDBOX_OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.getLogsUrl)
);

router.post(
  '/vm/reset',
  authorize(UserRole.SANDBOX_OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.resetVm)
);

router.get(
  '/vm/status',
  authorize(UserRole.FORENSIC_ANALYST, UserRole.SANDBOX_OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.getVmStatus)
);

router.get(
  '/monitoring/status',
  authorize(UserRole.FORENSIC_ANALYST, UserRole.SANDBOX_OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.getMonitoringStatus)
);

router.get(
  '/execution/status',
  authorize(UserRole.FORENSIC_ANALYST, UserRole.SANDBOX_OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.getExecutionStatus)
);

router.get(
  '/logs',
  authorize(UserRole.FORENSIC_ANALYST, UserRole.SANDBOX_OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.getLogs)
);

router.post(
  '/runtime/start',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.startRuntime)
);

router.post(
  '/sessions/start',
  authorize(UserRole.SANDBOX_OPERATOR, UserRole.FORENSIC_ANALYST, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.receiveSessionStart)
);

router.post(
  '/sessions/:sessionId/complete',
  authorize(UserRole.SANDBOX_OPERATOR, UserRole.FORENSIC_ANALYST, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.receiveSessionComplete)
);

router.post(
  '/sessions/:sessionId/events',
  authorize(UserRole.SANDBOX_OPERATOR, UserRole.FORENSIC_ANALYST, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(sandboxController.receiveEvents)
);

export default router;