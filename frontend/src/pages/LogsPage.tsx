import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Terminal,
  Search,
  Filter,
  RefreshCw,
  Download,
  Trash2,
  AlertTriangle,
  Info,
  Bug,
  AlertCircle,
  ShieldAlert,
  History,
  User,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { PageHeader, PageGrid } from '../layouts/PageContainer';
import { DashboardCard, DashboardStat } from '../components/enterprise/DashboardGrid';
import { cn } from '../design-system';
import { useLogsStore } from '../stores/logsStore';
import api from '../services/api';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };

const levelColors: Record<string, string> = {
  debug: 'text-slate-500 dark:text-slate-400',
  info: 'text-blue-600 dark:text-blue-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  critical: 'text-purple-600 dark:text-purple-400 font-bold',
};

const levelBgColors: Record<string, string> = {
  debug: 'bg-slate-50 dark:bg-slate-800/30',
  info: 'bg-blue-50/30 dark:bg-blue-900/10',
  warning: 'bg-amber-50/30 dark:bg-amber-900/10',
  error: 'bg-red-50/30 dark:bg-red-900/10',
  critical: 'bg-purple-50/30 dark:bg-purple-900/10',
};

const levelIcons: Record<string, typeof Info> = {
  debug: Bug,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  critical: ShieldAlert,
};

const categoryColors: Record<string, string> = {
  app: 'bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
  monitoring: 'bg-amber-500/15 text-amber-400',
  simulator: 'bg-blue-500/15 text-blue-400',
  execution: 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  forensics: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
  vm: 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  sandbox: 'bg-pink-100 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400',
  system: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400',
};

export function LogsPage() {
  const {
    logs, isLoading, error, filters, autoRefresh, stats,
    fetchLogs, fetchStats, setFilters, toggleAutoRefresh, clearLogs, downloadLogs,
  } = useLogsStore();

  const [search, setSearch] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ─── Audit log state (structured user/system events) ───
  type AuditEntry = {
    id: string;
    timestamp: string;
    action: string;
    entityType?: string;
    entityId?: string;
    status?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    user?: { id: string; username?: string; email?: string; name?: string } | null;
    errorMessage?: string;
  };
  const [view, setView] = useState<'system' | 'audit'>('audit');
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditStats, setAuditStats] = useState<{
    total: number;
    byAction: Array<{ action: string; count: number }>;
    byStatus: Record<string, number>;
  } | null>(null);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditStatusFilter, setAuditStatusFilter] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const [entriesResp, statsResp] = await Promise.all([
        api.getAuditLogs({
          page: 1,
          limit: 200,
          action: auditActionFilter || undefined,
          status: auditStatusFilter || undefined,
          search: auditSearch || undefined,
        }),
        api.getAuditStats(),
      ]);
      if (entriesResp.success && entriesResp.data) {
        setAuditEntries(entriesResp.data);
      }
      if (statsResp.success && statsResp.data) {
        setAuditStats(statsResp.data);
      }
    } catch (e: any) {
      setAuditError(e?.message || 'Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'audit') {
      fetchAuditLogs();
    }
  }, [view, auditActionFilter, auditStatusFilter]);

  // Debounce audit search
  useEffect(() => {
    if (view !== 'audit') return;
    const timer = setTimeout(() => {
      fetchAuditLogs();
    }, 300);
    return () => clearTimeout(timer);
  }, [auditSearch]);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filters.search) {
        setFilters({ search });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs({ page: 1 });
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, autoRefreshInterval]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleLevelFilter = (level: string) => {
    setFilters({ level });
    fetchLogs({ level, page: 1 });
  };

  const handleCategoryFilter = (category: string) => {
    setFilters({ category });
    fetchLogs({ category, page: 1 });
  };

  const totalLines = stats?.totalLines || 0;
  const errorCount = stats?.byLevel?.error || 0;
  const warningCount = stats?.byLevel?.warning || 0;
  const criticalCount = stats?.byLevel?.critical || 0;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <PageHeader
        title={view === 'audit' ? 'Audit Log' : 'System Logs'}
        subtitle={
          view === 'audit'
            ? 'Historical record of user and system actions'
            : 'Monitor forensic platform logs and events'
        }
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle: Audit (structured records) vs System (raw log files) */}
            <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-lg p-1">
              <button
                onClick={() => setView('audit')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
                  view === 'audit'
                    ? 'bg-white dark:bg-slate-700 text-amber-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                )}
              >
                <History className="w-3.5 h-3.5" />
                Audit
              </button>
              <button
                onClick={() => setView('system')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
                  view === 'system'
                    ? 'bg-white dark:bg-slate-700 text-amber-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                )}
              >
                <Terminal className="w-3.5 h-3.5" />
                System
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={() => {
                if (view === 'audit') {
                  fetchAuditLogs();
                } else {
                  fetchLogs();
                  fetchStats();
                }
              }}
            >
              Refresh
            </Button>
            {view === 'system' && (
              <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={downloadLogs} disabled={logs.length === 0}>
                Export
              </Button>
            )}
          </div>
        }
      />

      {view === 'audit' ? (
        <>
          <PageGrid columns={4}>
            <DashboardCard>
              <DashboardStat
                label="Total Events"
                value={auditStats?.total || 0}
                icon={<History className="w-5 h-5 text-amber-400" />}
              />
            </DashboardCard>
            <DashboardCard>
              <DashboardStat
                label="Successful"
                value={auditStats?.byStatus?.success || 0}
                icon={<CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
              />
            </DashboardCard>
            <DashboardCard>
              <DashboardStat
                label="Failed"
                value={auditStats?.byStatus?.failed || 0}
                icon={<XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
              />
            </DashboardCard>
            <DashboardCard>
              <DashboardStat
                label="Action Types"
                value={auditStats?.byAction?.length || 0}
                icon={<Filter className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
              />
            </DashboardCard>
          </PageGrid>

          <Card>
            <div className="p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search by action, entity, or ID..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <Select
                  value={auditActionFilter}
                  onChange={(val) => setAuditActionFilter(val)}
                  options={[
                    { value: '', label: 'All Actions' },
                    { value: 'LOGIN', label: 'User Login' },
                    { value: 'REGISTRATION', label: 'Registration' },
                    { value: 'LOGOUT', label: 'Logout' },
                    { value: 'EVIDENCE_UPLOADED', label: 'Evidence Uploaded' },
                    { value: 'EVIDENCE', label: 'Evidence (any)' },
                    { value: 'SESSION', label: 'Sandbox Session (any)' },
                    { value: 'TELEMETRY_INGESTED', label: 'Telemetry Ingested' },
                    { value: 'INVESTIGATION', label: 'Investigation (any)' },
                    { value: 'BLOCKCHAIN', label: 'Blockchain (any)' },
                  ]}
                />
                <Select
                  value={auditStatusFilter}
                  onChange={(val) => setAuditStatusFilter(val)}
                  options={[
                    { value: '', label: 'All Status' },
                    { value: 'success', label: 'Success' },
                    { value: 'failed', label: 'Failed' },
                  ]}
                />
              </div>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden">
            <div className="bg-slate-900 text-slate-100 font-mono text-xs">
              <div className="px-4 py-2 bg-slate-800 flex items-center justify-between border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-400" />
                  <span className="text-slate-300">Audit Trail</span>
                </div>
                <span className="text-slate-500">{auditEntries.length} entries</span>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {auditLoading && auditEntries.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full" />
                  </div>
                ) : auditError ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <p className="text-red-400 mb-3">{auditError}</p>
                    <Button variant="outline" size="sm" onClick={fetchAuditLogs}>Retry</Button>
                  </div>
                ) : auditEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <History className="w-10 h-10 text-slate-600 mb-3" />
                    <p className="text-slate-500">No audit records yet.</p>
                    <p className="text-slate-600 text-[10px] mt-1">Login, evidence uploads, and session events will appear here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {auditEntries.map((entry) => {
                      const isFailed = entry.status === 'failed';
                      return (
                        <div
                          key={entry.id}
                          className={cn(
                            'px-4 py-2 hover:bg-slate-800/50 transition-colors',
                            isFailed && 'bg-red-900/10'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <span className={cn('flex-shrink-0 mt-0.5', isFailed ? 'text-red-400' : 'text-emerald-400')}>
                              {isFailed ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            </span>
                            <span className="flex-shrink-0 text-slate-500 w-44">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                            <span className={cn(
                              'flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                              isFailed ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'
                            )}>
                              {entry.action}
                            </span>
                            {entry.entityType && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300">
                                {entry.entityType}
                              </span>
                            )}
                            <div className="flex-1 min-w-0 text-slate-300">
                              {entry.user ? (
                                <span className="inline-flex items-center gap-1 mr-3">
                                  <User className="w-3 h-3 text-slate-500" />
                                  {entry.user.email || entry.user.username || entry.user.name || entry.user.id}
                                </span>
                              ) : (
                                <span className="text-slate-500 mr-3">system</span>
                              )}
                              {entry.entityId && (
                                <span className="text-slate-500 mr-3 font-mono">id: {entry.entityId.slice(0, 24)}</span>
                              )}
                              {entry.ipAddress && (
                                <span className="text-slate-500 mr-3">from {entry.ipAddress}</span>
                              )}
                              {entry.errorMessage && (
                                <span className="text-red-400">{entry.errorMessage}</span>
                              )}
                            </div>
                          </div>
                          {entry.details && Object.keys(entry.details).length > 0 && (
                            <div className="mt-1 ml-7 text-[10px] text-slate-500 truncate">
                              {Object.entries(entry.details).slice(0, 4).map(([k, v]) => (
                                <span key={k} className="mr-3">
                                  {k}=<span className="text-slate-400">{String(v).slice(0, 60)}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {auditStats && auditStats.byAction.length > 0 && (
            <Card>
              <div className="p-4">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase mb-3">Action Distribution</p>
                <div className="flex gap-2 flex-wrap">
                  {auditStats.byAction.slice(0, 12).map(({ action, count }) => (
                    <button
                      key={action}
                      onClick={() => setAuditActionFilter(action)}
                      className={cn(
                        'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                        auditActionFilter === action
                          ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                      )}
                    >
                      {action}: <span className="font-bold">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </>
      ) : (
        <>
      <PageGrid columns={4}>
        <DashboardCard>
          <DashboardStat
            label="Total Lines"
            value={totalLines}
            icon={<Terminal className="w-5 h-5 text-amber-400" />}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Errors"
            value={errorCount}
            icon={<AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Warnings"
            value={warningCount}
            icon={<AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Critical"
            value={criticalCount}
            icon={<ShieldAlert className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
          />
        </DashboardCard>
      </PageGrid>

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select
              value={filters.level}
              onChange={(val) => handleLevelFilter(val)}
              options={[
                { value: '', label: 'All Levels' },
                { value: 'debug', label: 'Debug' },
                { value: 'info', label: 'Info' },
                { value: 'warning', label: 'Warning' },
                { value: 'error', label: 'Error' },
                { value: 'critical', label: 'Critical' },
              ]}
            />
            <Select
              value={filters.category}
              onChange={(val) => handleCategoryFilter(val)}
              options={[
                { value: '', label: 'All Categories' },
                { value: 'app', label: 'App' },
                { value: 'monitoring', label: 'Monitoring' },
                { value: 'simulator', label: 'Simulator' },
                { value: 'execution', label: 'Execution' },
                { value: 'forensics', label: 'Forensics' },
                { value: 'vm', label: 'VM' },
                { value: 'sandbox', label: 'Sandbox' },
                { value: 'system', label: 'System' },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? 'primary' : 'outline'}
              size="sm"
              leftIcon={<RefreshCw className={cn('w-4 h-4', autoRefresh && 'animate-spin')} />}
              onClick={toggleAutoRefresh}
            >
              {autoRefresh ? 'Live' : 'Auto-refresh'}
            </Button>
            {autoRefresh && (
              <Select
                value={String(autoRefreshInterval)}
                onChange={(val) => setAutoRefreshInterval(Number(val))}
                options={[
                  { value: '3', label: '3s' },
                  { value: '5', label: '5s' },
                  { value: '10', label: '10s' },
                  { value: '30', label: '30s' },
                ]}
              />
            )}
            <Button variant="ghost" size="sm" onClick={clearLogs} title="Clear logs from view">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="bg-slate-900 dark:bg-slate-900 text-slate-100 font-mono text-xs overflow-hidden">
          <div className="px-4 py-2 bg-slate-800 dark:bg-slate-900 flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300">Live Log Stream</span>
              {autoRefresh && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
            </div>
            <span className="text-slate-500">{logs.length} entries</span>
          </div>

          <div className="max-h-[500px] overflow-y-auto p-0">
            {isLoading && logs.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full" />
              </div>
            ) : error && logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-red-400 mb-3">{error}</p>
                <Button variant="outline" size="sm" onClick={() => fetchLogs()}>Retry</Button>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Terminal className="w-10 h-10 text-slate-600 mb-3" />
                <p className="text-slate-500">No logs found. Run simulations to generate logs.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {logs.map((log) => {
                  const Icon = levelIcons[log.level] || Info;
                  const isExpanded = expandedLog === log.id;
                  return (
                    <div key={log.id} className={cn('px-4 py-1.5 hover:bg-slate-800/50 cursor-pointer transition-colors', levelBgColors[log.level])}>
                      <div className="flex items-start gap-2" onClick={() => setExpandedLog(isExpanded ? null : log.id)}>
                        <span className={cn('flex-shrink-0 mt-0.5', levelColors[log.level])}>
                          <Icon className="w-3 h-3" />
                        </span>
                        <span className="flex-shrink-0 text-slate-500 w-36">{log.timestamp}</span>
                        <span className={cn('flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium uppercase', categoryColors[log.category])}>
                          {log.category}
                        </span>
                        <span className="flex-shrink-0 w-12 text-center text-slate-400">{log.level.toUpperCase()}</span>
                        <span className="flex-1 text-slate-300 break-all">{log.message}</span>
                      </div>
                      {isExpanded && log.details && (
                        <div className="mt-2 ml-6 p-2 bg-slate-900 rounded border border-slate-700 text-slate-400 text-xs">
                          <pre className="whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>
      </Card>

      {stats && (
        <Card>
          <div className="p-4">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase mb-3">Level Distribution</p>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(stats.byLevel || {}).map(([level, count]) => {
                const Icon = levelIcons[level] || Info;
                return (
                  <button key={level} onClick={() => handleLevelFilter(level)}
                    className={cn('inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      filters.level === level
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    )}>
                    <Icon className="w-3 h-3" />
                    {level}: <span className="font-bold">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      )}
        </>
      )}
    </motion.div>
  );
}

export default LogsPage;

