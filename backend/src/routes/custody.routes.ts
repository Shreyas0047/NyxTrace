/**
 * Chain of Custody Routes
 * API endpoints for chain-of-custody management
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware';
import { custodyController } from '../controllers/custody.controller';

const router = Router();

/**
 * @route   GET /api/v1/custody/chain/:evidenceId
 * @desc    Get chain of custody visualization
 * @access  Private (Authenticated)
 */
router.get('/chain/:evidenceId', authenticate, custodyController.getChainOfCustody);

/**
 * @route   GET /api/v1/custody/timeline/:evidenceId
 * @desc    Get full custody timeline
 * @access  Private (Authenticated)
 */
router.get('/timeline/:evidenceId', authenticate, custodyController.getCustodyTimeline);

/**
 * @route   POST /api/v1/custody/event
 * @desc    Add custody event
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/event',
  authenticate,
  authorize(['super_admin', 'admin', 'analyst']),
  custodyController.addCustodyEvent
);

/**
 * @route   GET /api/v1/custody/verification-history/:evidenceId
 * @desc    Get verification history
 * @access  Private (Authenticated)
 */
router.get(
  '/verification-history/:evidenceId',
  authenticate,
  custodyController.getVerificationHistory
);

/**
 * @route   POST /api/v1/custody/transfer
 * @desc    Transfer custody
 * @access  Private (Authenticated, Admin)
 */
router.post(
  '/transfer',
  authenticate,
  authorize(['super_admin', 'admin']),
  custodyController.transferCustody
);

/**
 * @route   GET /api/v1/custody/lineage-graph/:investigationId
 * @desc    Get evidence lineage graph
 * @access  Private (Authenticated)
 */
router.get('/lineage-graph/:investigationId', authenticate, custodyController.getLineageGraph);

/**
 * @route   GET /api/v1/custody/integrity-stats
 * @desc    Get integrity statistics
 * @access  Private (Authenticated)
 */
router.get('/integrity-stats', authenticate, custodyController.getIntegrityStats);

/**
 * @route   GET /api/v1/custody/tamper-investigations
 * @desc    Get open tamper investigations
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.get(
  '/tamper-investigations',
  authenticate,
  authorize(['super_admin', 'admin', 'analyst']),
  custodyController.getTamperInvestigations
);

/**
 * @route   POST /api/v1/custody/tamper-investigation
 * @desc    Create tamper investigation
 * @access  Private (Authenticated, Admin)
 */
router.post(
  '/tamper-investigation',
  authenticate,
  authorize(['super_admin', 'admin']),
  custodyController.createTamperInvestigation
);

/**
 * @route   POST /api/v1/custody/tamper-investigation/:investigationId/update
 * @desc    Update tamper investigation
 * @access  Private (Authenticated, Admin)
 */
router.post(
  '/tamper-investigation/:investigationId/update',
  authenticate,
  authorize(['super_admin', 'admin']),
  custodyController.updateTamperInvestigation
);

/**
 * @route   POST /api/v1/custody/report
 * @desc    Generate verification report
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/report',
  authenticate,
  authorize(['super_admin', 'admin', 'analyst']),
  custodyController.generateReport
);

/**
 * @route   POST /api/v1/custody/report/:reportId/export
 * @desc    Export verification report
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/report/:reportId/export',
  authenticate,
  authorize(['super_admin', 'admin', 'analyst']),
  custodyController.exportReport
);

export default router;
