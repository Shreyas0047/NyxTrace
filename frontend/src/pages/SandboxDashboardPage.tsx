import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Square,
  RotateCcw,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Timer,
  Server,
  Terminal,
  Loader2,
  FileText,
  Network,
  Cpu,
  Zap,
  Shield,
  Bug,
  Hash,
  Layers,
  Pause,
  PlayCircle,
  Search,
  Copy,
  Trash2,
  RefreshCw,
  ArrowDown,
  ArrowUp,
  Database,
  Lock,
  Globe,
  Target,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge, SeverityBadge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { PageHeader, PageGrid } from '../layouts/PageContainer';
import { DashboardCard, DashboardStat } from '../components/enterprise/DashboardGrid';
import { useSandboxStore } from '../stores/sandboxStore';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useLogsStore } from '../stores/logsStore';
import { useRealtimeStore } from '../stores/realtimeStore';
import { useStatusStore } from '../stores/statusStore';
import { socketService, SocketEvent } from '../services/socket';
import api from '../services/api';
import { cn } from '../design-system';

type TabType = 'sessions' | 'monitoring' | 'timeline' | 'telemetry' | 'logs';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };

const levelColors: Record<string, string> = {
  ERROR: 'bg-red-500/20 text-red-400 border-red-500/30',
  WARNING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  INFO: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  DEBUG: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const levelBorderColors: Record<string, string> = {
  ERROR: 'border-l-red-500',
  WARNING: 'border-l-amber-500',
  INFO: 'border-l-amber-500',
  DEBUG: 'border-l-slate-500',
};

const categoryIcons: Record<string, React.ReactNode> = {
  process: <Cpu className="w-3.5 h-3.5" />,
  file: <FileText className="w-3.5 h-3.5" />,
  registry: <Lock className="w-3.5 h-3.5" />,
  network: <Globe className="w-3.5 h-3.5" />,
  threat: <Target className="w-3.5 h-3.5" />,
  anomaly: <AlertTriangle className="w-3.5 h-3.5" />,
};

const categoryColors: Record<string, string> = {
  process: 'bg-amber-500/20 text-amber-400',
  file: 'bg-violet-500/20 text-violet-400',
  registry: 'bg-amber-500/20 text-amber-400',
  network: 'bg-blue-500/20 text-blue-400',
  threat: 'bg-red-500/20 text-red-400',
  anomaly: 'bg-orange-500/20 text-orange-400',
};

export function SandboxDashboardPage() {
  const {
    sessions,
    stats,
    health,
    monitoringStatus,
    executionStatus: _executionStatus,
    simulators,
    activeSession,
    fetchSessions,
    fetchStats,
    fetchSimulators,
    fetchHealth,
    fetchMonitoringStatus,
    fetchExecutionStatus,
    startSession,
    stopSession,
    resetVm,
    startRuntime,
    isLoading,
    isExecuting,
  } = useSandboxStore();

  const telemetry = useTelemetryStore();
  const logs = useLogsStore();
  const showStatus = useStatusStore((s) => s.show);
  const isSocketConnected = useRealtimeStore((s) => s.isConnected);

  const [statusFilter, setStatusFilter] = useState('all');
  const [simulatorFilter, setSimulatorFilter] = useState('all');
  const [selectedSession, setSelectedSession] = useState<(typeof sessions)[0] | null>(null);
  const [selectedSimulator, setSelectedSimulator] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const [persistedMonitoring, setPersistedMonitoring] = useState<any>(null);
  const prevSessionIdRef = useRef<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const telemetryEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const telemetryContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSessions({ page: 1, limit: 50 });
    fetchStats();
    fetchSimulators();
    fetchHealth();
    fetchMonitoringStatus();
    fetchExecutionStatus();
    logs.fetchHistorical(200);
    telemetry.connect();
    logs.connect();

    return () => {
      telemetry.disconnect();
      logs.disconnect();
    };
  }, [fetchSessions, fetchStats, fetchSimulators, fetchHealth, fetchMonitoringStatus, fetchExecutionStatus]);

  // Poll at 3s when active session, 10s otherwise; always poll even with Socket.IO
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isSocketConnected || activeSession) {
        fetchHealth();
        fetchMonitoringStatus();
        fetchExecutionStatus();
      }
    }, activeSession ? 3000 : 10000);

    return () => clearInterval(interval);
  }, [isSocketConnected, activeSession?.session_id, activeSession?.state, fetchHealth, fetchMonitoringStatus, fetchExecutionStatus]);

  // Fetch persisted monitoring data for completed sessions
  useEffect(() => {
    if (activeTab === 'monitoring' && !monitoringStatus && sessions.length > 0) {
      const lastCompleted = sessions.find(s => s.status === 'completed');
      if (lastCompleted) {
        api.getSessionMonitoring(lastCompleted.sessionId).then((res) => {
          if (res.success) setPersistedMonitoring(res.data);
        }).catch((err) => console.error('Failed to fetch persisted monitoring:', err));
      }
    }
  }, [activeTab, monitoringStatus, sessions]);

  // Listen for real-time sandbox session updates via Socket.IO
  useEffect(() => {
    const unsub = socketService.on<any>(SocketEvent.SANDBOX_SESSION_UPDATE, (data) => {
      if (!data) return;
      const sessionId = data.session_id || data.sessionId;
      const state = data.state || data.status;
      if (sessionId && state) {
        useSandboxStore.setState({
          activeSession: {
            session_id: sessionId,
            state,
            simulator_id: data.simulator_id || data.simulatorId || activeSession?.simulator_id || '',
            created_at: data.created_at || activeSession?.created_at || new Date().toISOString(),
            updated_at: data.updated_at || new Date().toISOString(),
            error: data.error,
          },
        });
      }
    });
    return unsub;
  }, [activeSession?.simulator_id, activeSession?.created_at]);

  useEffect(() => {
    const sessionId = activeSession?.session_id || null;
    const isActive = activeSession && !['completed', 'failed', 'timeout', 'rolled_back'].includes(activeSession.state);
    if (isActive && sessionId && sessionId !== prevSessionIdRef.current) {
      prevSessionIdRef.current = sessionId;
      setSessionStartTime(new Date());
    }
    if (!isActive) {
      prevSessionIdRef.current = null;
    }
  }, [activeSession]);

  // Tick every second to update elapsed time display
  useEffect(() => {
    if (!sessionStartTime || !activeSession || ['completed', 'failed', 'timeout', 'rolled_back'].includes(activeSession.state)) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [sessionStartTime]);

  // When runtime comes online, fetch simulators if list is empty
  useEffect(() => {
    if (health && simulators.length === 0) {
      fetchSimulators();
    }
  }, [health, simulators.length, fetchSimulators]);

  useEffect(() => {
    if (logs.autoScroll && logsEndRef.current && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs.entries, logs.autoScroll]);

  useEffect(() => {
    if (telemetry.autoScroll && telemetryEndRef.current && telemetryContainerRef.current) {
      telemetryContainerRef.current.scrollTop = telemetryContainerRef.current.scrollHeight;
    }
  }, [telemetry.events, telemetry.autoScroll]);

  const handleStartSession = async () => {
    if (!selectedSimulator) return;
    showStatus('loading', 'Initializing sandbox session...', 'Restoring VM to clean baseline');
    telemetry.clear();
    const result = await startSession(selectedSimulator);
    if (result.success) {
      showStatus('success', 'Session started successfully', `Session ID: ${result.sessionId || 'N/A'}`);
      fetchSessions({ page: 1, limit: 50 });
      fetchStats();
      fetchExecutionStatus();
    } else {
      showStatus('error', 'Failed to start session', result.message || 'Unknown error');
    }
  };

  const handleStopSession = async () => {
    if (!activeSession) return;
    showStatus('loading', 'Stopping session...', 'Rolling back VM to clean state');
    const result = await stopSession(activeSession.session_id);
    if (result.success) {
      showStatus('success', 'Session stopped', 'VM restored to baseline snapshot');
      setSessionStartTime(null);
      telemetry.clear();
      fetchSessions({ page: 1, limit: 50 });
      fetchStats();
      fetchExecutionStatus();
    } else {
      showStatus('error', 'Failed to stop session', result.message || 'Unknown error');
    }
  };

  const handleResetVm = async () => {
    showStatus('loading', 'Resetting VM...', 'Restoring to CleanBaselinePython snapshot');
    const result = await resetVm();
    if (result.success) {
      showStatus('success', 'VM reset successfully', 'Ready for new session');
    } else {
      showStatus('error', 'Failed to reset VM', result.message || 'Unknown error');
    }
    fetchHealth();
    fetchMonitoringStatus();
  };

  const handleStartRuntime = async () => {
    showStatus('loading', 'Starting sandbox runtime...', 'Locating Python and launching forensic engine');
    const result = await startRuntime();
    if (result.success) {
      if (result.message?.includes('already running')) {
        showStatus('success', 'Runtime already online', 'Ready for sandbox sessions');
      } else {
        showStatus('success', 'Runtime online', 'Ready for sandbox sessions');
      }
      // Re-fetch simulators and health now that runtime is up
      await Promise.all([fetchSimulators(), fetchHealth()]);
    } else {
      showStatus('error', 'Failed to start runtime', result.message || 'Install Python 3.11+ and add to system PATH');
    }
  };

  const filteredSessions = sessions.filter((session) => {
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
    const matchesSimulator = simulatorFilter === 'all' || (session as any).simulator === simulatorFilter || session.simulatorId === simulatorFilter;
    return matchesStatus && matchesSimulator;
  });

  const formatSessionDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatElapsedTime = (startTime: Date) => {
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const runningCount = stats?.byStatus?.running || 0;
  const completedCount = stats?.byStatus?.completed || 0;
  const failedCount = (stats?.byStatus?.failed || 0) + (stats?.byStatus?.timeout || 0);

  const isSessionRunning = activeSession && !['completed', 'failed', 'timeout', 'rolled_back'].includes(activeSession.state);

  const processCount = monitoringStatus?.process_count || 0;
  const fileCount = monitoringStatus?.file_operations_count || 0;
  const registryCount = monitoringStatus?.registry_operations_count || 0;
  const networkCount = monitoringStatus?.network_operations_count || 0;
  const totalEvents = monitoringStatus?.total_events || 0;
  const behaviorAlerts = Array.isArray(monitoringStatus?.behavior_alerts)
    ? monitoringStatus.behavior_alerts.length
    : Number(monitoringStatus?.behavior_alerts || 0);

  const filteredLogs = logs.entries.filter((entry) => {
    const matchesLevel = logs.filterLevel === 'all' || entry.level === logs.filterLevel;
    const matchesText = !logs.filterText || entry.message.toLowerCase().includes(logs.filterText.toLowerCase());
    return matchesLevel && matchesText;
  });

  const telemetryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    telemetry.events.forEach((e) => {
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    return counts;
  }, [telemetry.events]);

  const exportLogs = useCallback(() => {
    const text = filteredLogs.map((l) => `[${l.level}] ${l.timestamp}: ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sandbox-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  const copyLogs = useCallback(() => {
    const text = filteredLogs.map((l) => `[${l.level}] ${l.timestamp}: ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
  }, [filteredLogs]);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <PageHeader
        title="Sandbox Dashboard"
        subtitle="Enterprise malware analysis and forensic investigation platform"
        actions={
          <div className="flex items-center gap-2">
            {!health ? (
              <Button variant="outline" size="sm" onClick={handleStartRuntime} disabled={isLoading}>
                <Zap className="w-4 h-4" />
                Start Runtime
              </Button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs text-emerald-700 dark:text-emerald-400">Runtime Online</span>
              </div>
            )}

            {isSessionRunning && activeSession && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/50">
                <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Running Session</span>
                <span className="text-xs text-blue-500 dark:text-blue-500 font-mono">{activeSession.session_id.slice(0, 8)}</span>
              </div>
            )}

            {activeSession && activeSession.state === 'completed' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Session Completed</span>
              </div>
            )}

            {activeSession && ['timeout', 'rolled_back'].includes(activeSession.state) && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  {activeSession.state === 'timeout' ? 'Session Timed Out' : 'Session Interrupted'}
                </span>
              </div>
            )}

            {activeSession && activeSession.state === 'failed' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/50">
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs font-medium text-red-700 dark:text-red-400">Session Failed</span>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={handleResetVm} disabled={isLoading || isExecuting || !health}>
              <RotateCcw className="w-4 h-4" />
              Reset VM
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStopSession}
              disabled={!isSessionRunning || isLoading}
              className="text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Square className="w-4 h-4" />
              Stop Session
            </Button>
            <Button
              size="sm"
              onClick={handleStartSession}
              disabled={!selectedSimulator || isExecuting || isSessionRunning || !health}
            >
              {isExecuting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              New Session
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <Select
          value={selectedSimulator}
          onChange={(val) => setSelectedSimulator(val)}
          options={[
            {
              value: '',
              label: !health
                ? 'Runtime not connected — click Start Runtime'
                : simulators.length === 0
                  ? 'No simulators available'
                  : 'Select Threat Simulator...',
            },
            ...simulators.map((s) => ({ value: s.id, label: s.display_name })),
          ]}
          className="w-64"
        />
        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              health?.vm_status?.state === 'running' ? 'bg-emerald-500 animate-pulse' :
              health?.vm_status?.state === 'stopped' ? 'bg-slate-400' :
              health?.vm_status?.error ? 'bg-red-500' :
              'bg-slate-400'
            )} />
            <Bug className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-slate-600 dark:text-slate-400">VM:</span>
            <span className={cn(
              "text-sm font-medium",
              health?.vm_status?.state === 'running' ? 'text-emerald-600 dark:text-emerald-400' :
              health?.vm_status?.state === 'stopped' ? 'text-slate-500' :
              health?.vm_status?.error ? 'text-red-600 dark:text-red-400' :
              'text-slate-500'
            )}>
              {health?.vm_status?.state === 'running' ? 'Running' :
               health?.vm_status?.state === 'stopped' ? 'Stopped' :
               health?.vm_status?.error ? 'Error' :
               'Unknown'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-600" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Events:</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">{totalEvents}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Alerts:</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">{behaviorAlerts}</span>
          </div>
        </div>
      </div>

      {isSessionRunning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-gradient-to-r from-blue-500 to-amber-500 rounded-lg flex items-center justify-between text-white"
        >
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <div>
              <p className="font-semibold">Session Active: {activeSession?.session_id.slice(0, 12)}</p>
              <p className="text-sm text-blue-100 capitalize">{activeSession?.state.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{sessionStartTime && formatElapsedTime(sessionStartTime)}</p>
              <p className="text-xs text-blue-100">Elapsed</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleStopSession} className="bg-white/20 hover:bg-white/30 border-0">
              <Square className="w-4 h-4" />
              Stop
            </Button>
          </div>
        </motion.div>
      )}

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {(['sessions', 'monitoring', 'timeline', 'telemetry', 'logs'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'sessions' && ` (${sessions.length})`}
            {tab === 'monitoring' && totalEvents > 0 && ` (${totalEvents})`}
            {tab === 'timeline' && telemetry.events.length > 0 && ` (${telemetry.events.length})`}
            {tab === 'telemetry' && telemetry.events.length > 0 && ` (${telemetry.events.length})`}
            {tab === 'logs' && logs.entries.length > 0 && ` (${logs.entries.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'sessions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-4">
              <Select
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'running', label: 'Running' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'failed', label: 'Failed' },
                  { value: 'timeout', label: 'Timeout' },
                ]}
                className="w-36"
              />
              <Select
                value={simulatorFilter}
                onChange={(val) => setSimulatorFilter(val)}
                options={[
                  { value: 'all', label: 'All Simulators' },
                  ...simulators.map((s) => ({ value: s.id, label: s.display_name })),
                ]}
                className="w-48"
              />
              <div className="ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await api.clearSandboxSessions();
                    useSandboxStore.setState({ sessions: [], activeSession: null, stats: null });
                    setSelectedSession(null);
                    fetchSessions({ page: 1, limit: 50 });
                    fetchStats();
                    showStatus('success', 'Sessions cleared', 'All session history has been removed');
                  }}
                  className="text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Sessions
                </Button>
              </div>
            </div>

            <Card>
              {isLoading ? (
                <div className="p-8 text-center text-slate-500">Loading sessions...</div>
              ) : filteredSessions.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No sessions found. Start a new session to begin analysis.</div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-[400px] overflow-y-auto">
                  {filteredSessions.map((session) => (
                    <motion.div
                      key={session.id}
                      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                      onClick={() => setSelectedSession(session)}
                      className={cn(
                        'px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors',
                        selectedSession?.id === session.id && 'bg-amber-500/10'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center',
                            session.status === 'running' && 'bg-amber-500/15',
                            session.status === 'completed' && 'bg-emerald-100 dark:bg-emerald-900/20',
                            session.status === 'failed' && 'bg-red-100 dark:bg-red-900/20',
                            session.status === 'timeout' && 'bg-amber-100 dark:bg-amber-900/20',
                            !['running', 'completed', 'failed', 'timeout'].includes(session.status) && 'bg-slate-100 dark:bg-slate-800'
                          )}
                        >
                          {session.status === 'running' && <Play className="w-5 h-5 text-amber-400" />}
                          {session.status === 'completed' && <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                          {session.status === 'failed' && <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
                          {session.status === 'timeout' && <Timer className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
                          {!['running', 'completed', 'failed', 'timeout'].includes(session.status) && <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900 dark:text-white">
                              {session.simulatorName || session.simulatorId}
                            </p>
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                              {session.sessionId?.slice(0, 8)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 dark:text-slate-500">
                            <span>{session.vmName}</span>
                            <span>·</span>
                            <span>{formatSessionDuration(session.duration)}</span>
                            <span>·</span>
                            <span>{session.eventsCollected || 0} events</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.suspiciousScore && (
                            <SeverityBadge
                              severity={
                                session.suspiciousScore > 80 ? 'critical' : session.suspiciousScore > 60 ? 'high' : 'medium'
                              }
                              size="sm"
                            />
                          )}
                          <StatusBadge status={session.status} size="sm" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div>
            {selectedSession ? (
              <Card>
                <div className="p-5">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Session Details</h3>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-700'
                        )}
                      >
                        <Terminal className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {selectedSession.simulatorName || selectedSession.simulatorId}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {selectedSession.sessionId?.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Execution session
                    </p>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Status</span>
                      <StatusBadge status={selectedSession.status} size="sm" />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">VM</span>
                      <span className="text-slate-700 dark:text-slate-300">{selectedSession.vmName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Duration</span>
                      <span className="text-slate-700 dark:text-slate-300">{formatSessionDuration(selectedSession.duration)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Events</span>
                      <span className="text-slate-700 dark:text-slate-300">{selectedSession.eventsCollected || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Evidence</span>
                      <span className="text-slate-700 dark:text-slate-300">{selectedSession.evidenceFiles?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Started</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {selectedSession.startTime ? new Date(selectedSession.startTime).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {(selectedSession as any).error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg mt-4">
                      <p className="text-sm text-red-700 dark:text-red-400 font-medium mb-1">Error</p>
                      <p className="text-xs text-red-600 dark:text-red-500">{(selectedSession as any).error}</p>
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Card>
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                    <Server className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Select a session to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'monitoring' && (
        <PageGrid columns={4}>
          <DashboardCard>
            <DashboardStat
              label="Process Events"
              value={processCount}
              icon={<Cpu className="w-5 h-5 text-amber-400" />}
              delta="Live monitoring"
            />
          </DashboardCard>
          <DashboardCard>
            <DashboardStat
              label="File Operations"
              value={fileCount}
              icon={<FileText className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
              delta="File system activity"
            />
          </DashboardCard>
          <DashboardCard>
            <DashboardStat
              label="Registry Changes"
              value={registryCount}
              icon={<Hash className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
              delta="Registry modifications"
            />
          </DashboardCard>
          <DashboardCard>
            <DashboardStat
              label="Network Events"
              value={networkCount}
              icon={<Network className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              delta="Network activity"
            />
          </DashboardCard>
        </PageGrid>
      )}

      {activeTab === 'monitoring' && !monitoringStatus && !persistedMonitoring && (
        <Card>
          <div className="flex flex-col items-center justify-center py-16">
            <Activity className="w-12 h-12 text-slate-400 mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No monitoring data available</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Start the runtime and run a session to see live monitoring data</p>
          </div>
        </Card>
      )}

      {activeTab === 'monitoring' && (monitoringStatus || persistedMonitoring) && (
        <div className="space-y-6">
          {/* Session summary strip */}
          {persistedMonitoring && (
            <Card>
              <div className="p-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Session Summary</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {persistedMonitoring.totalEvents} events · {persistedMonitoring.process} process · {persistedMonitoring.file} file · {persistedMonitoring.registry} registry · {persistedMonitoring.network} network
                </p>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  Event Categories
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {(() => {
                  const cats = monitoringStatus?.events_by_category
                    ? Object.entries(monitoringStatus.events_by_category)
                    : persistedMonitoring
                      ? Object.entries(persistedMonitoring).filter(([k]) => ['process', 'file', 'registry', 'network', 'credential'].includes(k) && typeof persistedMonitoring[k] === 'number' && persistedMonitoring[k] > 0)
                      : [];
                  return cats.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No events captured yet</p>
                  ) : (
                    cats.map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">{category.replace(/_/g, ' ')}</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{count as number}</span>
                      </div>
                    ))
                  );
                })()}
              </div>
            </Card>

            <Card>
              <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Events by Severity
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {(() => {
                  const sevs = monitoringStatus?.events_by_severity
                    ? Object.entries(monitoringStatus.events_by_severity)
                    : persistedMonitoring?.severityCounts
                      ? Object.entries(persistedMonitoring.severityCounts).filter(([, c]) => (c as number) > 0)
                      : [];
                  return sevs.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No severity data yet</p>
                  ) : (
                    sevs.map(([severity, count]) => (
                      <div key={severity} className="flex items-center justify-between">
                        <span className={cn(
                          'text-sm capitalize px-2 py-0.5 rounded',
                          severity === 'critical' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                          severity === 'high' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                          severity === 'medium' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                          severity === 'low' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                          severity === 'info' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        )}>{severity}</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{count as number}</span>
                      </div>
                    ))
                  );
                })()}
              </div>
            </Card>

            {monitoringStatus?.suspicious_activities && monitoringStatus.suspicious_activities.length > 0 && (
              <Card className="lg:col-span-2">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                  <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-600" />
                    Suspicious Activities Detected
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {(monitoringStatus.suspicious_activities as Array<{indicator?: string; description?: string; severity?: string}>).map((activity, idx) => (
                    <div key={idx} className="p-4 flex items-start gap-4">
                      <div className={cn(
                        'w-2 h-2 rounded-full mt-2',
                        activity.severity === 'critical' && 'bg-red-500',
                        activity.severity === 'high' && 'bg-orange-500',
                        activity.severity === 'medium' && 'bg-amber-500',
                        activity.severity === 'low' && 'bg-emerald-500',
                      )} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{activity.indicator || 'Unknown'}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{activity.description || ''}</p>
                      </div>
                      {activity.severity && (
                        <SeverityBadge severity={activity.severity as 'critical' | 'high' | 'medium' | 'low'} size="sm" />
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {persistedMonitoring?.suspiciousActivities && persistedMonitoring.suspiciousActivities.length > 0 && (
              <Card className="lg:col-span-2">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                  <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-600" />
                    Suspicious Activities (Persisted)
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {persistedMonitoring.suspiciousActivities.map((activity: any, idx: number) => (
                    <div key={idx} className="p-4 flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full mt-2 bg-amber-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{activity.eventType || 'Event'}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{activity.severity || 'info'} severity</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <Card className="h-[550px] flex flex-col">
          <div className="p-3 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
            <div className="flex items-center gap-3">
              <Timer className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Event Timeline
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ({telemetry.events.length} events, chronological)
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {telemetry.events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Timer className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">No timeline events yet</p>
                <p className="text-xs text-slate-400 mt-1">Start a sandbox session to see events in chronological order</p>
              </div>
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-500 via-violet-500 to-amber-500" />
                {[...telemetry.events]
                  .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime())
                  .map((event, idx) => {
                    const ts = event.timestamp ? new Date(event.timestamp) : new Date();
                    const cat = (event.category || event.event_type || 'system').toLowerCase();
                    const sev = (event.severity || 'info').toLowerCase();
                    const dotColor =
                      sev === 'critical' ? 'bg-red-500' :
                      sev === 'high' ? 'bg-orange-500' :
                      sev === 'medium' ? 'bg-amber-500' :
                      cat === 'process' ? 'bg-amber-500' :
                      cat === 'file' ? 'bg-violet-500' :
                      cat === 'registry' ? 'bg-amber-500' :
                      cat === 'network' ? 'bg-blue-500' :
                      'bg-slate-500';
                    return (
                      <div key={idx} className="relative mb-4 ml-4">
                        <div className={cn('absolute -left-[26px] top-1.5 w-3 h-3 rounded-full ring-4 ring-white dark:ring-slate-900', dotColor)} />
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700/50">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                              {ts.toLocaleTimeString('en-US', { hour12: false })}.{String(ts.getMilliseconds()).padStart(3, '0')}
                            </span>
                            <span className={cn('px-2 py-0.5 text-[10px] font-mono rounded uppercase', categoryColors[cat] || 'bg-slate-500/20 text-slate-400')}>
                              {cat}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {event.event_type || event.type || 'Event'}
                          </p>
                          {event.message && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{event.message}</p>
                          )}
                          {event.details && typeof event.details === 'object' && (
                            <div className="mt-1 text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                              {Object.entries(event.details).slice(0, 2).map(([k, v]) => (
                                <span key={k} className="mr-3">{k}={String(v).slice(0, 60)}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'telemetry' && (
        <Card className="h-[550px] flex flex-col">
          <div className="p-3 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', telemetry.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500')} />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {telemetry.isConnected ? 'Live' : 'Disconnected'}
                </span>
              </div>
              <div className="h-4 w-px bg-slate-300 dark:bg-slate-600" />
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-amber-500" />
                  <span className="text-slate-500">Process:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{telemetryCounts.process || 0}</span>
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3 text-violet-500" />
                  <span className="text-slate-500">File:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{telemetryCounts.file || 0}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-500" />
                  <span className="text-slate-500">Registry:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{telemetryCounts.registry || 0}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3 text-blue-500" />
                  <span className="text-slate-500">Network:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{telemetryCounts.network || 0}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => telemetry.toggleAutoScroll()}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  telemetry.autoScroll ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-slate-600'
                )}
                title={telemetry.autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
              >
                {telemetry.autoScroll ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
              </button>
              <button
                onClick={() => telemetry.togglePause()}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  telemetry.isPaused ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'text-slate-400 hover:text-slate-600'
                )}
                title={telemetry.isPaused ? 'Resume' : 'Pause'}
              >
                {telemetry.isPaused ? <PlayCircle className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                onClick={() => telemetry.clear()}
                className="p-1.5 rounded text-slate-400 hover:text-slate-600 transition-colors"
                title="Clear"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div
            ref={telemetryContainerRef}
            className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1.5 bg-slate-900"
          >
            {telemetry.events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Database className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Waiting for forensic events...</p>
                <p className="text-xs mt-1 text-slate-600">Start a session to capture live telemetry</p>
              </div>
            ) : (
              telemetry.events.map((event, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    'flex items-start gap-2 p-2 rounded border-l-2 bg-slate-800/50',
                    event.category === 'process' ? 'border-l-amber-500' :
                    event.category === 'file' ? 'border-l-violet-500' :
                    event.category === 'registry' ? 'border-l-amber-500' :
                    event.category === 'network' ? 'border-l-blue-500' :
                    event.category === 'threat' ? 'border-l-red-500' :
                    event.category === 'anomaly' ? 'border-l-orange-500' :
                    'border-l-slate-500'
                  )}
                >
                  <span className="text-slate-600 shrink-0 w-20">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 flex items-center gap-1',
                    categoryColors[event.category] || 'bg-slate-700 text-slate-400'
                  )}>
                    {categoryIcons[event.category]}
                    {event.category}
                  </span>
                  <span className="text-slate-300 truncate flex-1">
                    {event.event_type}
                  </span>
                  {event.data && Object.keys(event.data).length > 0 && (
                    <span className="text-slate-500 shrink-0 max-w-[200px] truncate" title={JSON.stringify(event.data)}>
                      {JSON.stringify(event.data).slice(0, 80)}
                    </span>
                  )}
                </motion.div>
              ))
            )}
            <div ref={telemetryEndRef} />
          </div>
        </Card>
      )}

      {activeTab === 'logs' && (
        <Card className="h-[550px] flex flex-col">
          <div className="p-3 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', logs.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500')} />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {logs.isConnected ? 'Live Stream' : 'Disconnected'}
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-600" />
                <span className="text-xs text-slate-500">{logs.entries.length} entries</span>
                <span className="text-xs text-slate-500">·</span>
                <span className="text-xs text-slate-500">{filteredLogs.length} shown</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportLogs}
                  className="p-1.5 rounded text-slate-400 hover:text-slate-600 transition-colors"
                  title="Export Logs"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  onClick={copyLogs}
                  className="p-1.5 rounded text-slate-400 hover:text-slate-600 transition-colors"
                  title="Copy Logs"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => logs.togglePause()}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    logs.isPaused ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'text-slate-400 hover:text-slate-600'
                  )}
                  title={logs.isPaused ? 'Resume' : 'Pause'}
                >
                  {logs.isPaused ? <PlayCircle className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => logs.toggleAutoScroll()}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    logs.autoScroll ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-slate-600'
                  )}
                  title={logs.autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
                >
                  {logs.autoScroll ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => logs.clear()}
                  className="p-1.5 rounded text-slate-400 hover:text-slate-600 transition-colors"
                  title="Clear Logs"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => logs.fetchHistorical(200)}
                  className="p-1.5 rounded text-slate-400 hover:text-slate-600 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={logs.filterText}
                  onChange={(e) => logs.setFilterText(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <Select
                value={logs.filterLevel}
                onChange={(val) => logs.setFilterLevel(val)}
                options={[
                  { value: 'all', label: 'All Levels' },
                  { value: 'INFO', label: 'Info' },
                  { value: 'WARNING', label: 'Warning' },
                  { value: 'ERROR', label: 'Error' },
                  { value: 'DEBUG', label: 'Debug' },
                ]}
                className="w-32"
              />
            </div>
          </div>
          <div
            ref={logsContainerRef}
            className="flex-1 overflow-y-auto font-mono text-xs bg-slate-900"
          >
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Terminal className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">No logs available</p>
                <p className="text-xs mt-1 text-slate-600">Logs will appear when runtime is active</p>
              </div>
            ) : (
              filteredLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'py-1 px-3 border-l-2 hover:bg-slate-900/80 transition-colors',
                    levelBorderColors[log.level] || 'border-l-slate-500'
                  )}
                >
                  <span className="text-slate-600 mr-2">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={cn(
                    'mr-2 px-1.5 py-0.5 rounded text-[10px] font-medium border',
                    levelColors[log.level] || 'bg-slate-700 text-slate-400 border-slate-600'
                  )}>
                    {log.level}
                  </span>
                  {log.session_id && (
                    <span className="mr-2 text-slate-600 text-[10px]">
                      [{log.session_id.slice(0, 8)}]
                    </span>
                  )}
                  <span className="text-slate-300">{log.message}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-4 gap-4">
        <DashboardCard>
          <DashboardStat
            label="Total Sessions"
            value={stats?.total || sessions.length}
            icon={<Server className="w-5 h-5 text-amber-400" />}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Completed"
            value={completedCount}
            icon={<CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Running"
            value={runningCount}
            icon={<Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Failed/Timeout"
            value={failedCount}
            icon={<AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />}
          />
        </DashboardCard>
      </div>
    </motion.div>
  );
}

export default SandboxDashboardPage;

