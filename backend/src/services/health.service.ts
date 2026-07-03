/**
 * Health Monitoring Service
 * Platform-wide health checks and metrics
 */

import logger, { auditLogger } from '../config/logger';
import mongoose from 'mongoose';
import { getConnectionPoolStats } from './database-optimization.service';
import { getWorkerStats } from './queue.service';
import { getServiceHealth } from '../middleware/tracing.middleware';
import { SandboxSession } from '../models';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  version: string;
  services: Record<string, ServiceHealthStatus>;
  metrics: PlatformMetrics;
}

export interface ServiceHealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  lastCheck: string;
  message?: string;
}

export interface PlatformMetrics {
  requests: {
    total: number;
    success: number;
    failed: number;
    averageLatency: number;
  };
  database: {
    connections: number;
    buffers: number;
    responseTime: number;
  };
  workers: {
    verification: WorkerStats;
    telemetry: WorkerStats;
    analytics: WorkerStats;
    threat: WorkerStats;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

export interface WorkerStats {
  pending: number;
  processing: number;
  total: number;
}

/**
 * Health Monitor
 */
class HealthMonitor {
  private startTime: number = Date.now();
  private requestCount = 0;
  private successCount = 0;
  private failedCount = 0;
  private latencySum = 0;
  private version = '1.0.0';

  /**
   * Record a request
   */
  recordRequest(success: boolean, latency: number): void {
    this.requestCount++;
    if (success) {
      this.successCount++;
    } else {
      this.failedCount++;
    }
    this.latencySum += latency;
  }

  /**
   * Check service health
   */
  async checkServiceHealth(serviceName: string): Promise<ServiceHealthStatus> {
    try {
      switch (serviceName) {
        case 'database':
          return await this.checkDatabaseHealth();
        case 'websocket':
          return await this.checkWebSocketHealth();
        case 'blockchain':
          return await this.checkBlockchainHealth();
        case 'queue':
          return await this.checkQueueHealth();
        case 'aiService':
          return await this.checkExternalService(
            process.env.AI_SERVICE_URL || 'http://localhost:8000',
            '/health'
          );
        case 'sandboxAgent':
          return await this.checkExternalService(
            process.env.SANDBOX_RUNTIME_URL || 'http://127.0.0.1:8765',
            '/health'
          );
        default:
          return {
            status: 'healthy',
            lastCheck: new Date().toISOString(),
          };
      }
    } catch (error) {
      return {
        status: 'down',
        lastCheck: new Date().toISOString(),
        message: (error as Error).message,
      };
    }
  }

  /**
   * Probe an external HTTP service health endpoint
   */
  private async checkExternalService(baseUrl: string, path: string): Promise<ServiceHealthStatus> {
    const start = Date.now();
    try {
      const axios = (await import('axios')).default;
      const resp = await axios.get(`${baseUrl}${path}`, { timeout: 3000 });
      const latency = Date.now() - start;
      return {
        status: resp.status === 200 ? (latency < 500 ? 'healthy' : 'degraded') : 'degraded',
        latency,
        lastCheck: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        status: 'down',
        latency: Date.now() - start,
        lastCheck: new Date().toISOString(),
        message: error.code === 'ECONNREFUSED' ? 'Service not running' : (error.message || 'Unreachable'),
      };
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ServiceHealthStatus> {
    const start = Date.now();

    try {
      await mongoose.connection.db?.admin().ping();
      const latency = Date.now() - start;

      return {
        status: latency < 100 ? 'healthy' : latency < 500 ? 'degraded' : 'down',
        latency,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'down',
        latency: Date.now() - start,
        lastCheck: new Date().toISOString(),
        message: (error as Error).message,
      };
    }
  }

  /**
   * Check WebSocket health
   */
  private async checkWebSocketHealth(): Promise<ServiceHealthStatus> {
    // In a real implementation, this would check the Socket.IO connection
    return {
      status: 'healthy',
      lastCheck: new Date().toISOString(),
    };
  }

  /**
   * Check blockchain health
   */
  private async checkBlockchainHealth(): Promise<ServiceHealthStatus> {
    const start = Date.now();
    try {
      const { blockchainService } = await import('../blockchain/blockchain.service');
      const provider = blockchainService.getProvider();
      if (provider) {
        const network = await provider.getNetwork();
        const latency = Date.now() - start;
        return {
          status: latency < 1000 ? 'healthy' : 'degraded',
          latency,
          lastCheck: new Date().toISOString(),
          message: `Connected to chain ID ${network.chainId}`,
        };
      }
      return {
        status: 'degraded',
        lastCheck: new Date().toISOString(),
        message: 'Blockchain not initialized',
      };
    } catch (error) {
      return {
        status: 'down',
        latency: Date.now() - start,
        lastCheck: new Date().toISOString(),
        message: (error as Error).message,
      };
    }
  }

  /**
   * Check queue health
   */
  private async checkQueueHealth(): Promise<ServiceHealthStatus> {
    const workerStats = getWorkerStats();
    const totalPending = Object.values(workerStats).reduce(
      (sum, stat) => sum + stat.pending,
      0
    );

    return {
      status: totalPending < 100 ? 'healthy' : totalPending < 500 ? 'degraded' : 'down',
      lastCheck: new Date().toISOString(),
      message: `${totalPending} jobs pending`,
    };
  }

  /**
   * Get platform metrics
   */
  getMetrics(): PlatformMetrics {
    const memUsage = process.memoryUsage();
    const memTotal = memUsage.heapTotal;
    const memUsed = memUsage.heapUsed;

    const workerStats = getWorkerStats();

    return {
      requests: {
        total: this.requestCount,
        success: this.successCount,
        failed: this.failedCount,
        averageLatency:
          this.requestCount > 0
            ? Math.round(this.latencySum / this.requestCount)
            : 0,
      },
      database: {
        ...getConnectionPoolStats(),
        responseTime: 0, // Will be populated from actual check
      },
      workers: {
        verification: workerStats.verification,
        telemetry: workerStats.telemetry,
        analytics: workerStats.analytics,
        threat: workerStats.threat,
      },
      memory: {
        used: Math.round(memUsed / (1024 * 1024)),
        total: Math.round(memTotal / (1024 * 1024)),
        percentage: Math.round((memUsed / memTotal) * 100),
      },
    };
  }

  /**
   * Check for stale sandbox sessions (no heartbeat >90s) and mark as failed.
   * This reconciles the state when an agent disconnects without a clean shutdown.
   */
  async checkStaleSessions(): Promise<number> {
    try {
      const staleThreshold = new Date(Date.now() - 90 * 1000);

      const result = await SandboxSession.updateMany(
        {
          status: 'running',
          $or: [
            { lastHeartbeat: { $lt: staleThreshold } },
            { lastHeartbeat: null, createdAt: { $lt: staleThreshold } },
          ],
        },
        {
          $set: {
            status: 'failed',
            endTime: new Date(),
            errorMessages: ['Session agent disconnected'],
          },
        }
      );

      if (result.modifiedCount > 0) {
        logger.warn(
          `[StaleSessions] Marked ${result.modifiedCount} stale session(s) as failed (no heartbeat for >90s)`
        );
      }

      return result.modifiedCount;
    } catch (error) {
      logger.error('[StaleSessions] Failed to check for stale sessions:', error);
      return 0;
    }
  }

  /**
   * Get full health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const services: Record<string, ServiceHealthStatus> = {};

    // Always-on critical services
    const criticalServices: string[] = ['database', 'websocket', 'queue', 'sandboxAgent'];

    // Optional services — only probed when explicitly enabled. Otherwise we'd
    // permanently show them as 'down' and degrade the overall status, which
    // hides real problems behind known-disabled features.
    if ((process.env.AI_SERVICE_ENABLED ?? 'false').toLowerCase() === 'true') {
      criticalServices.push('aiService');
    }
    if ((process.env.BLOCKCHAIN_ENABLED ?? 'false').toLowerCase() === 'true') {
      criticalServices.push('blockchain');
    }

    for (const service of criticalServices) {
      services[service] = await this.checkServiceHealth(service);
    }

    const metrics = this.getMetrics();

    // Determine overall status
    const serviceStatuses = Object.values(services).map(s => s.status);
    let overallStatus: 'healthy' | 'degraded' | 'down' = 'healthy';

    if (serviceStatuses.includes('down')) {
      overallStatus = 'down';
    } else if (serviceStatuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: this.version,
      services,
      metrics,
    };
  }

  /**
   * Get readiness status (for Kubernetes)
   */
  async getReadinessStatus(): Promise<{
    ready: boolean;
    checks: Record<string, boolean>;
  }> {
    const checks: Record<string, boolean> = {};
    let ready = true;

    // Check database
    try {
      await mongoose.connection.db?.admin().ping();
      checks.database = true;
    } catch {
      checks.database = false;
      ready = false;
    }

    // Check memory
    const memUsage = process.memoryUsage();
    const memPercentage = memUsage.heapUsed / memUsage.heapTotal;
    checks.memory = memPercentage < 0.9;
    if (!checks.memory) ready = false;

    return { ready, checks };
  }

  /**
   * Get liveness status (for Kubernetes)
   */
  getLivenessStatus(): { alive: boolean; uptime: number } {
    return {
      alive: true,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.requestCount = 0;
    this.successCount = 0;
    this.failedCount = 0;
    this.latencySum = 0;
    logger.info('Health metrics reset');
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitor();

/**
 * Health check endpoint handler
 */
export async function healthCheckHandler(): Promise<HealthStatus> {
  return healthMonitor.getHealthStatus();
}

/**
 * Readiness check handler
 */
export async function readinessCheckHandler(): Promise<{
  ready: boolean;
  checks: Record<string, boolean>;
}> {
  return healthMonitor.getReadinessStatus();
}

/**
 * Liveness check handler
 */
export function livenessCheckHandler(): { alive: boolean; uptime: number } {
  return healthMonitor.getLivenessStatus();
}

/**
 * Metrics export for Prometheus
 */
export function getPrometheusMetrics(): string {
  const metrics = healthMonitor.getMetrics();

  return `
# HELP forensics_requests_total Total number of requests
# TYPE forensics_requests_total counter
forensics_requests_total ${metrics.requests.total}

# HELP forensics_requests_success Total successful requests
# TYPE forensics_requests_success counter
forensics_requests_success ${metrics.requests.success}

# HELP forensics_requests_failed Total failed requests
# TYPE forensics_requests_failed counter
forensics_requests_failed ${metrics.requests.failed}

# HELP forensics_request_latency_ms Average request latency in milliseconds
# TYPE forensics_request_latency_ms gauge
forensics_request_latency_ms ${metrics.requests.averageLatency}

# HELP forensics_memory_used_bytes Memory used in bytes
# TYPE forensics_memory_used_bytes gauge
forensics_memory_used_bytes ${metrics.memory.used * 1024 * 1024}

# HELP forensics_queue_pending Total pending jobs
# TYPE forensics_queue_pending gauge
forensics_queue_pending ${Object.values(metrics.workers).reduce((sum, w) => sum + w.pending, 0)}

# HELP forensics_queue_processing Total processing jobs
# TYPE forensics_queue_processing gauge
forensics_queue_processing ${Object.values(metrics.workers).reduce((sum, w) => sum + w.processing, 0)}
`.trim();
}

// ============================================
// Stale Session Reconciliation (background task)
// Runs every 30 seconds to detect and mark sessions
// whose agent has disconnected without a clean shutdown.
// ============================================
setInterval(() => {
  healthMonitor.checkStaleSessions().catch((err: Error) => {
    logger.error('[StaleSessions] Reconciliation interval error:', err);
  });
}, 30 * 1000).unref();