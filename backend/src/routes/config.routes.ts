import { Router } from 'express';
import { configController } from '../controllers';
import { authenticate, authorize, asyncHandler } from '../middleware';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);

router.get('/', authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), asyncHandler(configController.getConfig));
router.put('/', authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), asyncHandler(configController.updateConfig));
router.get('/:section', authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), asyncHandler(configController.getSection));
router.post('/reset', authorize(UserRole.SUPER_ADMIN), asyncHandler(configController.resetConfig));

export default router;
