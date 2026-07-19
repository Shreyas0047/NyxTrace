/**
 * Routes Index
 * Central export for all route modules
 */

import { Router } from 'express';
import { config } from '../config';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import investigationRoutes from './investigation.routes';
import evidenceRoutes from './evidence.routes';
import sandboxRoutes from './sandbox.routes';
import syncRoutes from './sync.routes';
import aiRoutes from './ai.routes';
import blockchainRoutes from '../blockchain/routes/blockchain.routes';
import custodyRoutes from './custody.routes';
import threatRoutes from './threat.routes';
import analyticsRoutes from './analytics.routes';
import operationsRoutes from './operations.routes';
import reportsRoutes from './reports.routes';
import logsRoutes from './logs.routes';
import settingsRoutes from './settings.routes';
import evidenceArtifactsRoutes from './evidence-artifacts.routes';
import threatAnalysisRoutes from './threat-analysis.routes';
import alertRoutes from './alerts.routes';
import analysisRoutes from './analysis.routes';
import knowledgeRoutes from './knowledge.routes';
import rolesRoutes from './roles.routes';
import configRoutes from './config.routes';

const router = Router();

// API version prefix
const API_PREFIX = `/api/${config.server.apiVersion}`;

// Mount routes
router.use(`${API_PREFIX}/auth`, authRoutes);
router.use(`${API_PREFIX}/users`, userRoutes);
router.use(`${API_PREFIX}/investigations`, investigationRoutes);
router.use(`${API_PREFIX}/evidence`, evidenceRoutes);
router.use(`${API_PREFIX}/sandbox`, sandboxRoutes);
router.use(`${API_PREFIX}/sync`, syncRoutes);
router.use(`${API_PREFIX}/ai`, aiRoutes);
router.use(`${API_PREFIX}/blockchain`, blockchainRoutes);
router.use(`${API_PREFIX}/custody`, custodyRoutes);
router.use(`${API_PREFIX}/threat`, threatRoutes);
router.use(`${API_PREFIX}/analytics`, analyticsRoutes);
router.use(`${API_PREFIX}/operations`, operationsRoutes);
router.use(`${API_PREFIX}/reports`, reportsRoutes);
router.use(`${API_PREFIX}/logs`, logsRoutes);
router.use(`${API_PREFIX}/settings`, settingsRoutes);
router.use(`${API_PREFIX}/evidence/artifacts`, evidenceArtifactsRoutes);
router.use(`${API_PREFIX}/threat-analysis`, threatAnalysisRoutes);
router.use(`${API_PREFIX}/alerts`, alertRoutes);
router.use(`${API_PREFIX}/analysis`, analysisRoutes);
router.use(`${API_PREFIX}/knowledge-base`, knowledgeRoutes);
router.use(`${API_PREFIX}/roles`, rolesRoutes);
router.use(`${API_PREFIX}/config`, configRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    data: {
      version: config.server.apiVersion,
      environment: config.server.nodeEnv,
      timestamp: new Date().toISOString(),
    },
  });
});

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'NyxTrace API',
    version: '1.0.0',
    description: 'AI-Powered Cybercrime Digital NyxTrace',
    documentation: '/api/v1',
  });
});

export default router;
