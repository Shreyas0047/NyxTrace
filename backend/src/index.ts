/**
 * NyxTrace Backend - Main Entry Point
 * Express.js server with enterprise-grade architecture
 */

import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config, validateConfig } from './config';
import logger from './config/logger';
import { connectToDatabase, checkDatabaseHealth, closeDatabase } from './config/database';
import routes from './routes';
import { errorHandler, notFoundHandler, sanitizeRequest, validateRequestIntegrity, logSecurityEvent, correlationIdMiddleware, tracingMiddleware, requestContextMiddleware } from './middleware';
import fs from 'fs';
import { evidenceService, analysisService } from './services';
import { websocketService } from './services/websocket.service';
import { blockchainService } from './blockchain/blockchain.service';
import { smartContractService } from './blockchain/smart-contract.service';
import { distributedVerificationService } from './blockchain/verification-worker.service';

// Initialize Express app
const app: Express = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: config.security.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Correlation IDs and tracing — must run before any handler that might log,
// so X-Correlation-ID is available end-to-end.
app.use(correlationIdMiddleware);
app.use(requestContextMiddleware);
app.use(tracingMiddleware);

// Rate limiting — consistent across all environments
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => {
      logger.info(message.trim());
    },
  },
}));

// Initialize storage
evidenceService.initializeStorage();
if (!fs.existsSync('./uploads/analysis')) {
  fs.mkdirSync('./uploads/analysis', { recursive: true });
}

// Request sanitization and integrity check
app.use(sanitizeRequest);
app.use((req, res, next) => {
  const { valid, threats } = validateRequestIntegrity(req);
  if (!valid) {
    logSecurityEvent(req, 'REQUEST_INTEGRITY_VIOLATION', {
      threat: threats.join(', '),
      severity: 'high',
      ip: req.ip,
    });
    res.status(400).json({ success: false, message: 'Request rejected' });
    return;
  }
  next();
});

// API routes
app.use(routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'NyxTrace API',
    version: '1.0.0',
    description: 'AI-Powered Cybercrime Digital NyxTrace',
    documentation: '/api/v1',
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function startServer(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();

    // Connect to database
    await connectToDatabase();

    // Initialize blockchain services
    await blockchainService.initialize().catch(() => {});
    await smartContractService.initialize().catch(() => {});
    distributedVerificationService.startWorker().catch(() => {});

    // Start listening
    const { port, nodeEnv } = config.server;

    // Initialize WebSocket service
    const server = app.listen(port, () => {
      websocketService.initialize(server);
      logger.info([
        '============================================================',
        'NyxTrace Backend',
        '------------------------------------------------------------',
        `Environment: ${nodeEnv}`,
        `Port: ${port}`,
        `API Version: ${config.server.apiVersion}`,
        'WebSocket: Enabled',
        '============================================================',
      ].join('\n'));
      /*
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎯 NyxTrace Backend                               ║
║   ─────────────────────────────────────────────               ║
║                                                               ║
║   Environment: ${nodeEnv.padEnd(45)}║
║   Port: ${port.toString().padEnd(50)}║
║   API Version: ${config.server.apiVersion.padEnd(41)}║
║   WebSocket: Enabled                                         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      */

      logger.info('Backend services initialized successfully');
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      websocketService.shutdown();
      server.close(async () => {
        logger.info('HTTP server closed');
        await closeDatabase();
        logger.info('Database connection closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Health check for orchestration
export async function healthCheck(): Promise<{
  status: string;
  timestamp: string;
  services: {
    api: string;
    database: string;
  };
}> {
  const dbHealth = await checkDatabaseHealth();

  return {
    status: dbHealth.status === 'connected' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      api: 'ok',
      database: dbHealth.status,
    },
  };
}

// Export app for testing
export { app };

// Start if run directly
if (require.main === module) {
  startServer();
}

export default app;
