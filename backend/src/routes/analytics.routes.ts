/**
 * Analytics Routes
 * API endpoints for behavioral analytics and investigation correlation
 */

import { Router } from 'express';
import { authenticate, authorize, asyncHandler } from '../middleware';
import { analyticsController } from '../controllers/analytics.controller';

const router = Router();

// ============================================
// BEHAVIORAL ANALYTICS
// ============================================

/**
 * @route   GET /api/v1/analytics/patterns
 * @desc    Get behavioral patterns
 * @access  Private (Authenticated)
 */
router.get('/patterns', authenticate, analyticsController.getBehavioralPatterns);

/**
 * @route   POST /api/v1/analytics/analyze-behavior
 * @desc    Analyze process behavior
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/analyze-behavior',
  authenticate,
  authorize(['admin', 'forensic_analyst']),
  analyticsController.analyzeProcessBehavior
);

/**
 * @route   POST /api/v1/analytics/detect-anomalies
 * @desc    Detect anomalies in evidence
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/detect-anomalies',
  authenticate,
  authorize(['admin', 'forensic_analyst']),
  analyticsController.detectAnomalies
);

/**
 * @route   POST /api/v1/analytics/baseline
 * @desc    Analyze behavioral baseline
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/baseline',
  authenticate,
  authorize(['admin', 'forensic_analyst']),
  analyticsController.analyzeBaseline
);

// ============================================
// INVESTIGATION CORRELATION
// ============================================

/**
 * @route   GET /api/v1/analytics/clusters
 * @desc    Get investigation clusters
 * @access  Private (Authenticated)
 */
router.get('/clusters', authenticate, analyticsController.getInvestigationClusters);

/**
 * @route   GET /api/v1/analytics/clusters/:investigationId/relationships
 * @desc    Get relationships for specific investigation
 * @access  Private (Authenticated)
 */
router.get(
  '/clusters/:investigationId/relationships',
  authenticate,
  analyticsController.getInvestigationRelationships
);

/**
 * @route   POST /api/v1/analytics/clusters/:investigationId/score
 * @desc    Score relationship between investigations
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.post(
  '/clusters/:investigationId/score',
  authenticate,
  authorize(['admin', 'forensic_analyst']),
  analyticsController.scoreRelationship
);

/**
 * @route   GET /api/v1/analytics/insights
 * @desc    Get correlation insights
 * @access  Private (Authenticated)
 */
router.get('/insights', authenticate, analyticsController.getCorrelationInsights);

/**
 * @route   GET /api/v1/analytics/cluster-visualization
 * @desc    Get cluster visualization data
 * @access  Private (Authenticated)
 */
router.get(
  '/cluster-visualization',
  authenticate,
  analyticsController.getClusterVisualization
);

/**
 * @route   GET /api/v1/analytics/dashboard
 * @desc    Get analytics dashboard data
 * @access  Private (Authenticated, Admin/Analyst)
 */
router.get(
  '/dashboard',
  authenticate,
  authorize(['admin', 'forensic_analyst']),
  analyticsController.getDashboardData
);

/**
 * @route   POST /api/v1/analytics/session/analyze
 * @desc    Analyze a sandbox session
 * @access  Private (Authenticated, Admin/Forensic Analyst)
 */
router.post(
  '/session/analyze',
  authenticate,
  authorize(['admin', 'forensic_analyst']),
  asyncHandler(analyticsController.analyzeSession.bind(analyticsController))
);

/**
 * @route   POST /api/v1/analytics/sessions/compare
 * @desc    Compare multiple sandbox sessions
 * @access  Private (Authenticated, Admin/Forensic Analyst)
 */
router.post(
  '/sessions/compare',
  authenticate,
  authorize(['admin', 'forensic_analyst']),
  asyncHandler(analyticsController.compareSessions.bind(analyticsController))
);

export default router;
