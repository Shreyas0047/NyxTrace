import { Router } from 'express';
import { rolesController } from '../controllers';
import { authenticate, asyncHandler } from '../middleware';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(rolesController.getRoles));
router.get('/permissions', asyncHandler(rolesController.getPermissions));

export default router;
