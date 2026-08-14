/**
 * Storage Routes
 * /api/v1/storage
 */

import { Router } from 'express';
import { storageController } from '../controllers/storage.controller';
import { authenticate, authorize, asyncHandler } from '../middleware';
import { UserRole } from '../types';

const router = Router();

// All storage routes require authentication and admin/super_admin role
router.use(authenticate);
router.use(authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN));

router.get(
  '/overview',
  asyncHandler(storageController.getOverview)
);

router.get(
  '/sessions',
  asyncHandler(storageController.listSessions)
);

router.get(
  '/categories/:key/files',
  asyncHandler(storageController.listFiles)
);

router.get(
  '/categories/:key/files/:filename/hash',
  asyncHandler(storageController.getFileHash)
);

router.delete(
  '/sessions/:sessionId',
  asyncHandler(storageController.deleteSessionFootprint)
);

router.delete(
  '/files',
  asyncHandler(storageController.deleteFiles)
);

router.delete(
  '/evidence/:id',
  asyncHandler(storageController.deleteEvidence)
);

router.delete(
  '/categories/:key',
  asyncHandler(storageController.purgeCategory)
);

router.post(
  '/purge',
  asyncHandler(storageController.purgeAll)
);

export default router;