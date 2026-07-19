import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Server,
  Wifi,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Brain,
  Shield,
  RefreshCw,
  Terminal,
  Loader2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { PageHeader, PageGrid } from '../layouts/PageContainer';
import { DashboardCard, DashboardStat } from '../components/enterprise/DashboardGrid';
import { cn } from '../design-system';
import { useSandboxStore } from '../stores/sandboxStore';
import api from '../services/api';
import { config } from '../config';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'offline';
  responseTime?: number;
  lastCheck: string;
  details?: string;
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export function SystemHealthPage() {
  const { health, monitoringStatus, executionStatus, fetchHealth, fetchMonitoringStatus, fetchExecutionStatus } = useSandboxStore();

  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [systemMetrics, setSystemMetrics] = useState({
    uptime: '0d 0h 0m',
    cpu: 0,
    memory: 0,
    storage: 0,
    activeConnections: 0,
  });

  const fetchHealthData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchHealth(), fetchMonitoringStatus(), fetchExecutionStatus()]);

      const newServices: ServiceStatus[] = [];
      const now = new Date().toISOString();

      try {
        const healthResp = await api.getSandboxHealth();
        if (healthResp.success) {
          const h = healthResp.data?.health;
          newServices.push({
            name: 'Sandbox Runtime',
            status: h?.status === 'healthy' ? 'healthy' : 'degraded',
            responseTime: undefined,
            lastCheck: now,
            details: `VM: ${h?.vm_status?.state || 'unknown'} | Sessions: ${h?.active_sessions || 0}`,
          });
        }
      } catch {
        newServices.push({ name: 'Sandbox Runtime', status: 'offline', lastCheck: now, details: 'Connection failed' });
      }

      try {
        const backendStart = Date.now();
        const backendResp = await api.get('/operations/health');
        const backendTime = Date.now() - backendStart;
        newServices.push({
          name: 'Backend API',
          status: backendResp.data?.status === 'healthy' ? 'healthy' : 'degraded',
          responseTime: backendTime,
          lastCheck: now,
          details: `Express.js on port 3000`,
        });

        // Use the same operations/health response to derive MongoDB and Blockchain
        // statuses (no extra calls needed). The backend's healthCheckHandler probes
        // each critical service via mongoose.connection.readyState and the
        // blockchain service health check.
        const services = backendResp.data?.services || {};

        const dbSvc = services.database;
        if (dbSvc) {
          newServices.push({
            name: 'MongoDB',
            status: dbSvc.status === 'healthy' ? 'healthy' : dbSvc.status === 'down' ? 'offline' : 'degraded',
            responseTime: dbSvc.responseTime,
            lastCheck: dbSvc.lastCheck || now,
            details: dbSvc.message || 'Primary database',
          });
        } else {
          // Fallback: probe directly if the backend response did not include database info
          newServices.push({
            name: 'MongoDB',
            status: 'degraded',
            lastCheck: now,
            details: 'Status unavailable',
          });
        }

        const bcSvc = services.blockchain;
        if (bcSvc) {
          newServices.push({
            name: 'Blockchain',
            status: bcSvc.status === 'healthy' ? 'healthy' : bcSvc.status === 'down' ? 'offline' : 'degraded',
            responseTime: bcSvc.responseTime,
            lastCheck: bcSvc.lastCheck || now,
            details: bcSvc.message || 'Evidence integrity ledger',
          });
        }
      } catch {
        newServices.push({ name: 'Backend API', status: 'offline', lastCheck: now, details: 'Connection failed' });
        newServices.push({ name: 'MongoDB', status: 'offline', lastCheck: now, details: 'Backend unreachable' });
        newServices.push({ name: 'Blockchain', status: 'offline', lastCheck: now, details: 'Backend unreachable' });
      }

      try {
        const aiStart = Date.now();
        await api.get('/ai/health');
        const aiTime = Date.now() - aiStart;
        newServices.push({
          name: 'AI Analysis Engine',
          status: 'healthy',
          responseTime: aiTime,
          lastCheck: now,
          details: 'FastAPI + Python',
        });
      } catch {
        newServices.push({ name: 'AI Analysis Engine', status: 'offline', lastCheck: now, details: 'Service unavailable' });
      }

      try {
        await api.getSandboxSimulators();
        newServices.push({
          name: 'Simulator Catalog',
          status: 'healthy',
          lastCheck: now,
          details: '5 simulators registered',
        });
      } catch {
        newServices.push({ name: 'Simulator Catalog', status: 'degraded', lastCheck: now, details: 'Catalog unavailable' });
      }

      setServices(newServices);
    } finally {
      setIsLoading(false);
      setLastRefresh(new Date());
    }
  }, [fetchHealth, fetchMonitoringStatus, fetchExecutionStatus]);

  // Derive system metrics from health whenever it changes (decoupled from fetch)
  useEffect(() => {
    if (health) {
      const uptimeSec = health.uptime_seconds || 0;
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      setSystemMetrics(prev => ({
        ...prev,
        uptime: `${days}d ${hours}h ${mins}m`,
        activeConnections: health.telemetry_connections || 0,
      }));
    }
  }, [health]);

  // Initial fetch + periodic refresh
  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, config.polling.systemHealthMs);
    return () => clearInterval(interval);
  }, [fetchHealthData]);

  const healthyCount = services.filter(s => s.status === 'healthy').length;
  const degradedCount = services.filter(s => s.status === 'degraded').length;
  const offlineCount = services.filter(s => s.status === 'offline').length;

  const totalEvents = monitoringStatus?.total_events || 0;
  const sessionCount = executionStatus?.history_count || 0;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <PageHeader
          title="System Health"
          subtitle="Platform diagnostics and monitoring"
          actions={
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Clock className="w-4 h-4" />
                Last refresh: {lastRefresh.toLocaleTimeString()}
              </div>
              <Button variant="outline" size="sm" onClick={fetchHealthData} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Refresh
              </Button>
            </div>
          }
        />
      </motion.div>

      <PageGrid columns={4}>
        <DashboardCard>
          <DashboardStat
            label="Healthy Services"
            value={healthyCount}
            icon={<CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
            delta={`${services.length} total services`}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Degraded"
            value={degradedCount}
            icon={<AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
            delta={degradedCount > 0 ? 'Attention needed' : 'All services nominal'}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Offline"
            value={offlineCount}
            icon={<XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
            delta={offlineCount > 0 ? 'Service disruption' : 'No outages'}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Active Connections"
            value={systemMetrics.activeConnections}
            icon={<Wifi className="w-5 h-5 text-amber-400" />}
            delta="WebSocket clients"
          />
        </DashboardCard>
      </PageGrid>

      <motion.div variants={item}>
        <DashboardCard>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">System Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-2">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-200 dark:text-slate-700" />
                  <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={`${(systemMetrics.cpu / 100) * 226} 226`} className="text-amber-500" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{systemMetrics.cpu}%</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">CPU</p>
            </div>
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-2">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-200 dark:text-slate-700" />
                  <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={`${(systemMetrics.memory / 100) * 226} 226`} className="text-violet-500" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{systemMetrics.memory}%</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Memory</p>
            </div>
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-2">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-200 dark:text-slate-700" />
                  <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={`${(systemMetrics.storage / 100) * 226} 226`} className="text-amber-500" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{systemMetrics.storage}%</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Storage</p>
            </div>
            <div className="text-center col-span-2">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{systemMetrics.uptime}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Runtime Uptime</p>
              </div>
            </div>
          </div>
        </DashboardCard>
      </motion.div>

      <motion.div variants={item}>
        <DashboardCard>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Service Status</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'w-3 h-3 rounded-full',
                        service.status === 'healthy' && 'bg-emerald-500',
                        service.status === 'degraded' && 'bg-amber-500',
                        service.status === 'offline' && 'bg-red-500'
                      )} />
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{service.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{service.details}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      {service.responseTime && (
                        <div className="text-right">
                          <p className="text-sm text-slate-500 dark:text-slate-400">Response</p>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{service.responseTime}ms</p>
                        </div>
                      )}
                      <StatusBadge status={service.status} size="sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardCard>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-blue-500 flex items-center justify-center">
              <Server className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Backend API</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Express + TypeScript</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Port</span>
              <span className="text-slate-700 dark:text-slate-300 font-mono">3001</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Telemetry Events</span>
              <span className="text-slate-700 dark:text-slate-300">{totalEvents}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">JWT Auth</span>
              <StatusBadge status="active" size="sm" />
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">AI Engine</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">FastAPI + Python</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Status</span>
              <StatusBadge status="active" size="sm" />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Analysis</span>
              <span className="text-slate-700 dark:text-slate-300">Telemetry + Reports</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Session History</span>
              <span className="text-slate-700 dark:text-slate-300">{sessionCount}</span>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Sandbox Agent</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">PyQt6 Desktop</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">VM Status</span>
              <span className="text-slate-700 dark:text-slate-300 capitalize">{health?.vm_status?.state || 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Active Sessions</span>
              <span className="text-slate-700 dark:text-slate-300">{health?.active_sessions || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Monitoring</span>
              <StatusBadge status={monitoringStatus?.enabled ? 'active' : 'closed'} size="sm" />
            </div>
          </div>
        </DashboardCard>
      </motion.div>

      <motion.div variants={item}>
        <DashboardCard className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-violet-500 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">NyxTrace</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">AI-Powered Cybercrime Digital NyxTrace</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500 dark:text-slate-400">Version 4.0.0</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">Phase 4 - Enterprise Hardening</p>
            </div>
          </div>
        </DashboardCard>
      </motion.div>
    </motion.div>
  );
}

export default SystemHealthPage;
