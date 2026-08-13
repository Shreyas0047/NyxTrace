/**
 * Threat Intelligence Routes
 * API endpoints for IOC and threat intelligence
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware';
import { threatIntelligenceController } from '../controllers/threat.controller';

const router = Router();

/**
 * @route   POST /api/v1/threat/ioc
 * @desc    Create IOC
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/ioc',
  authenticate,
  authorize(['admin', 'forensic_analyst']),
  threatIntelligenceController.createIOC
);

/**
 * @route   GET /api/v1/threat/ioc/:iocId
 * @desc    Get IOC by ID
 * @access  Private (Authenticated)
 */
router.get('/ioc/:iocId', authenticate, threatIntelligenceController.getIOC);

/**
 * @route   GET /api/v1/threat/iocs
 * @desc    Search IOCs
 * @access  Private (Authenticated)
 */
router.get('/iocs', authenticate, threatIntelligenceController.searchIOCs);

/**
 * @route   PATCH /api/v1/threat/ioc/:iocId/status
 * @desc    Update IOC status
 * @access  Private (Authenticated, Admin)
 */
router.patch(
  '/ioc/:iocId/status',
  authenticate,
  authorize(['admin']),
  threatIntelligenceController.updateIOCStatus
);

/**
 * @route   POST /api/v1/threat/ioc/link
 * @desc    Link IOC to evidence
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/ioc/link',
  authenticate,
  authorize(['admin', 'forensic_analyst']),
  threatIntelligenceController.linkIOCToEvidence
);

/**
 * @route   POST /api/v1/threat/ioc/match
 * @desc    Match IOCs against evidence hashes
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/ioc/match',
  authenticate,
  authorize(['admin', 'forensic_analyst']),
  threatIntelligenceController.matchIOCs
);

/**
 * @route   GET /api/v1/threat/correlation/:evidenceId
 * @desc    Correlate evidence
 * @access  Private (Authenticated)
 */
router.get(
  '/correlation/:evidenceId',
  authenticate,
  threatIntelligenceController.correlateEvidence
);

/**
 * @route   POST /api/v1/threat/correlation
 * @desc    Create threat correlation
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/correlation',
  authenticate,
  authorize(['admin', 'forensic_analyst']),
  threatIntelligenceController.createCorrelation
);

/**
 * @route   POST /api/v1/threat/enrich/:investigationId
 * @desc    Enrich investigation
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/enrich/:investigationId',
  authenticate,
  authorize(['admin', 'forensic_analyst']),
  threatIntelligenceController.enrichInvestigation
);

/**
 * @route   GET /api/v1/threat/analytics/:type
 * @desc    Generate threat analytics
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.get(
  '/analytics/:type',
  authenticate,
  authorize(['admin', 'forensic_analyst']),
  threatIntelligenceController.generateAnalytics
);

/**
 * @route   GET /api/v1/threat/stats
 * @desc    Get IOC statistics
 * @access  Private (Authenticated)
 */
router.get('/stats', authenticate, threatIntelligenceController.getStats);

/**
 * @route   GET /api/v1/threat/graph
 * @desc    Get threat relationship graph
 * @access  Private (Authenticated)
 */
router.get('/graph', authenticate, threatIntelligenceController.getThreatGraph);

export default router;
