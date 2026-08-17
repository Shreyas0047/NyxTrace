/**
 * Evidence Routes
 * /api/v1/evidence
 */

import { Router } from 'express';
import { evidenceController } from '../controllers';
import { authenticate, authorize, requirePermission, asyncHandler } from '../middleware';
import { UserRole, Permission } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List all evidence
router.get(
  '/',
  authorize(UserRole.FORENSIC_ANALYST, UserRole.SECURITY_REVIEWER, UserRole.SANDBOX_OPERATOR, UserRole.AUDITOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(evidenceController.findAll)
);

// Evidence upload (multipart/form-data)
router.post(
  '/upload',
  requirePermission(Permission.EVIDENCE_UPLOAD),
  evidenceController.uploadFile,
  asyncHandler(evidenceController.upload)
);

// Register a URL as evidence (no file upload)
router.post(
  '/url',
  requirePermission(Permission.EVIDENCE_UPLOAD),
  asyncHandler(evidenceController.registerUrl)
);

// Get evidence by investigation
router.get(
  '/investigation/:investigationId',
  authorize(UserRole.FORENSIC_ANALYST, UserRole.SECURITY_REVIEWER, UserRole.SANDBOX_OPERATOR, UserRole.AUDITOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(evidenceController.findByInvestigation)
);

// Get evidence by ID
router.get(
  '/:id',
  authorize(UserRole.FORENSIC_ANALYST, UserRole.SECURITY_REVIEWER, UserRole.SANDBOX_OPERATOR, UserRole.AUDITOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(evidenceController.findById)
);

// Verify evidence integrity
router.post(
  '/:id/verify',
  requirePermission(Permission.EVIDENCE_VERIFY),
  asyncHandler(evidenceController.verifyIntegrity)
);

// Simulate tampering with evidence (demo mode only)
router.post(
  '/:id/simulate-tamper',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(evidenceController.simulateTamper)
);

// Restore tampered evidence (demo mode only)
router.post(
  '/:id/restore',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(evidenceController.restoreTamper)
);

// Delete evidence
router.delete(
  '/:id',
  requirePermission(Permission.EVIDENCE_DELETE),
  asyncHandler(evidenceController.delete)
);

export default router;