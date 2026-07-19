import { Router } from 'express';
import { knowledgeController } from '../controllers';
import { authenticate, asyncHandler } from '../middleware';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(knowledgeController.findAll));
router.get('/:id', asyncHandler(knowledgeController.findById));
router.post('/', asyncHandler(knowledgeController.create));
router.put('/:id', asyncHandler(knowledgeController.update));
router.delete('/:id', asyncHandler(knowledgeController.delete));

export default router;
