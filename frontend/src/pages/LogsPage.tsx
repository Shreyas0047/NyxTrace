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
import {
  PageHeader, PageGrid, PageContainer, PageSection, EmptyState, LoadingSkeleton,
} from '../layouts/PageContainer';
import { DashboardCard, DashboardStat } from '../components/enterprise/DashboardGrid';
import { cn } from '../design-system';
import { useLogsStore } from '../stores/logsStore';
import api from '../services/api';
import { formatDateTime } from '../utils/helpers';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const levelColors: Record<string, string> = {
  debug: 'text-[var(--text-secondary)] ',
  info: 'text-blue-600 ',
  warning: 'text-amber-600  ',
  error: 'text-red-600  ',
  critical: 'text-purple-600  font-bold',
};

const levelBgColors: Record<string, string> = {
  debug: 'bg-[var(--surface-container-lowest)] ',
  info: 'bg-blue-50/30 ',
  warning: 'bg-amber-50/30 ',
  error: 'bg-red-50/30 ',
  critical: 'bg-purple-50/30 ',
};

const levelIcons: Record<string, typeof Info> = {
  debug: Bug,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  critical: ShieldAlert,
};

const categoryColors: Record<string, string> = {
  app: 'bg-violet-100  text-violet-600  ',
  monitoring: 'bg-amber-500/15 text-amber-600 ',
  simulator: 'bg-blue-500/15 text-blue-400',
  execution: 'bg-amber-100  text-amber-600  ',
  forensics: 'bg-emerald-100  text-emerald-600  ',
  vm: 'bg-orange-100  text-orange-600  ',
  sandbox: 'bg-pink-100  text-pink-600 ',
  system: 'bg-[var(--surface-container-low)]  text-[var(--text-secondary)] ',
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

  const viewToggle = (
    <div className="inline-flex items-center bg-[var(--surface-container-low)]  rounded-lg p-1">
      <button
        onClick={() => setView('audit')}
        className={cn(
          'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
          view === 'audit'
            ? 'bg-white  text-amber-600  shadow-sm'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-secondary)] '
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
            ? 'bg-white  text-amber-600  shadow-sm'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-secondary)] '
        )}
      >
        <Terminal className="w-3.5 h-3.5" />
        System
      </button>
    </div>
  );

  return (
    <PageContainer maxWidth="full" className="p-6 space-y-6">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={item}>
          <PageHeader
            eyebrow="Administration · Audit"
            title={view === 'audit' ? 'Audit Log' : 'System Logs'}
            subtitle={
              view === 'audit'
                ? 'Historical record of user and system actions'
                : 'Monitor forensic platform logs and events'
            }
            stamp={view === 'audit' ? 'AUDIT TRAIL' : 'SYSTEM LOG'}
            actions={
              <div className="flex items-center gap-2">
                {viewToggle}
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
        </motion.div>

        {view === 'audit' ? (
          <>
            <motion.div variants={item}>
              <PageGrid columns={4}>
                <DashboardCard>
                  <DashboardStat
                    label="Total Events"
                    value={auditStats?.total || 0}
                    stamp="EVENTS"
                    mono
                    delta="Recorded"
                    icon={<History className="w-5 h-5 text-amber-600 " />}
                  />
                </DashboardCard>
                <DashboardCard>
                  <DashboardStat
                    label="Successful"
                    value={auditStats?.byStatus?.success || 0}
                    stamp="OK"
                    mono
                    delta="Completed"
                    icon={<CheckCircle className="w-5 h-5 text-emerald-600  " />}
                  />
                </DashboardCard>
                <DashboardCard>
                  <DashboardStat
                    label="Failed"
                    value={auditStats?.byStatus?.failed || 0}
                    stamp="FAILED"
                    mono
                    delta="Blocked / errors"
                    icon={<XCircle className="w-5 h-5 text-red-600  " />}
                  />
                </DashboardCard>
                <DashboardCard>
                  <DashboardStat
                    label="Action Types"
                    value={auditStats?.byAction?.length || 0}
                    stamp="TYPES"
                    mono
                    delta="Unique actions"
                    icon={<Filter className="w-5 h-5 text-violet-600  " />}
                  />
                </DashboardCard>
              </PageGrid>
            </motion.div>

            <motion.div variants={item}>
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
                    <Filter className="w-4 h-4 text-[var(--text-secondary)] " />
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
            </motion.div>

            <motion.div variants={item}>
              <PageSection title="Audit Trail">
                <DashboardCard className="!p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[var(--text-tertiary)] font-mono text-[11px] uppercase tracking-[0.08em] border-b border-[var(--border-subtle)]">
                          <th className="p-3">Time</th>
                          <th className="p-3">Action</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Actor</th>
                          <th className="p-3">Entity ID</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">IP</th>
                          <th className="p-3">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {auditLoading && auditEntries.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-6">
                              <LoadingSkeleton rows={6} />
                            </td>
                          </tr>
                        ) : auditError ? (
                          <tr>
                            <td colSpan={8}>
                              <EmptyState
                                icon={<AlertCircle className="w-8 h-8 text-rose-600" />}
                                title="Failed to load audit records"
                                description={auditError}
                                stamp="ERROR"
                                action={<Button variant="outline" size="sm" onClick={fetchAuditLogs}>Retry</Button>}
                              />
                            </td>
                          </tr>
                        ) : auditEntries.length === 0 ? (
                          <tr>
                            <td colSpan={8}>
                              <EmptyState
                                icon={<History className="w-8 h-8 text-[var(--text-tertiary)]" />}
                                title="No audit records yet"
                                description="Login, evidence uploads, and session events will appear here."
                                stamp="EMPTY"
                              />
                            </td>
                          </tr>
                        ) : (
                          auditEntries.map((entry) => {
                            const isFailed = entry.status === 'failed';
                            return (
                              <tr
                                key={entry.id}
                                className={cn(
                                  'hover:bg-[var(--surface-container-lowest)] transition-colors',
                                  isFailed && 'bg-rose-50/40'
                                )}
                              >
                                <td className="p-3 font-mono text-[var(--text-secondary)] whitespace-nowrap">
                                  {formatDateTime(entry.timestamp)}
                                </td>
                                <td className="p-3">
                                  <span className={cn(
                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                                    isFailed ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                                  )}>
                                    {isFailed ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                                    {entry.action}
                                  </span>
                                </td>
                                <td className="p-3">
                                  {entry.entityType ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--surface-container-low)]  text-[var(--text-secondary)] ">
                                      {entry.entityType}
                                    </span>
                                  ) : (
                                    <span className="text-[var(--text-tertiary)]">—</span>
                                  )}
                                </td>
                                <td className="p-3 text-[var(--text-secondary)]">
                                  {entry.user ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <User className="w-3 h-3 text-[var(--text-secondary)]" />
                                      {entry.user.email || entry.user.username || entry.user.name || entry.user.id}
                                    </span>
                                  ) : (
                                    <span className="text-[var(--text-tertiary)]">system</span>
                                  )}
                                </td>
                                <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">
                                  {entry.entityId ? entry.entityId.slice(0, 24) : '—'}
                                </td>
                                <td className="p-3">
                                  <span className={cn(
                                    'px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider',
                                    isFailed ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                                  )}>
                                    {entry.status || 'success'}
                                  </span>
                                </td>
                                <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">
                                  {entry.ipAddress || '—'}
                                </td>
                                <td className="p-3">
                                  {entry.errorMessage && (
                                    <span className="text-rose-600 text-xs block mb-1">{entry.errorMessage}</span>
                                  )}
                                  {entry.details && Object.keys(entry.details).length > 0 && (
                                    <div
                                      className="text-[10px] text-[var(--text-tertiary)] font-mono max-w-[280px] truncate"
                                      title={JSON.stringify(entry.details)}
                                    >
                                      {Object.entries(entry.details).slice(0, 4).map(([k, v]) => (
                                        <span key={k} className="mr-2">
                                          {k}={String(v).slice(0, 40)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </DashboardCard>
              </PageSection>
            </motion.div>

            {auditStats && auditStats.byAction.length > 0 && (
              <motion.div variants={item}>
                <PageSection title="Action Distribution">
                  <Card>
                    <div className="p-4">
                      <div className="flex gap-2 flex-wrap">
                        {auditStats.byAction.slice(0, 12).map(({ action, count }) => (
                          <button
                            key={action}
                            onClick={() => setAuditActionFilter(action)}
                            className={cn(
                              'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                              auditActionFilter === action
                                ? 'bg-amber-500/10 border-amber-500/50 text-amber-600 '
                                : 'bg-[var(--surface-container-lowest)]  border-[var(--border-subtle)]  text-[var(--text-secondary)]  hover:bg-[var(--surface-container-low)] '
                            )}
                          >
                            {action}: <span className="font-bold">{count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </Card>
                </PageSection>
              </motion.div>
            )}
          </>
        ) : (
          <>
            <motion.div variants={item}>
              <PageGrid columns={4}>
                <DashboardCard>
                  <DashboardStat
                    label="Total Lines"
                    value={totalLines}
                    stamp="LINES"
                    mono
                    delta="Collected"
                    icon={<Terminal className="w-5 h-5 text-amber-600 " />}
                  />
                </DashboardCard>
                <DashboardCard>
                  <DashboardStat
                    label="Errors"
                    value={errorCount}
                    stamp="ERRORS"
                    mono
                    delta="Red alerts"
                    icon={<AlertCircle className="w-5 h-5 text-red-600  " />}
                  />
                </DashboardCard>
                <DashboardCard>
                  <DashboardStat
                    label="Warnings"
                    value={warningCount}
                    stamp="WARN"
                    mono
                    delta="Yellow alerts"
                    icon={<AlertTriangle className="w-5 h-5 text-amber-600  " />}
                  />
                </DashboardCard>
                <DashboardCard>
                  <DashboardStat
                    label="Critical"
                    value={criticalCount}
                    stamp="CRIT"
                    mono
                    delta="Escalations"
                    icon={<ShieldAlert className="w-5 h-5 text-purple-600 " />}
                  />
                </DashboardCard>
              </PageGrid>
            </motion.div>

            <motion.div variants={item}>
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
                    <Filter className="w-4 h-4 text-[var(--text-secondary)] " />
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
            </motion.div>

            <motion.div variants={item}>
              <PageSection title="Live Log Stream">
                <DashboardCard className="!p-0 overflow-hidden">
                  <div className="px-4 py-2 bg-[var(--surface-container-low)]  flex items-center justify-between border-b border-[var(--border-subtle)] ">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-amber-600 " />
                      <span className="text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider">Stream</span>
                      {autoRefresh && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
                    </div>
                    <span className="text-xs text-[var(--text-secondary)]">{logs.length} entries</span>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto">
                    {isLoading && logs.length === 0 ? (
                      <div className="p-6">
                        <LoadingSkeleton rows={6} />
                      </div>
                    ) : error && logs.length === 0 ? (
                      <EmptyState
                        icon={<AlertCircle className="w-8 h-8 text-rose-600" />}
                        title="Failed to load logs"
                        description={error}
                        stamp="ERROR"
                        action={<Button variant="outline" size="sm" onClick={() => fetchLogs()}>Retry</Button>}
                      />
                    ) : logs.length === 0 ? (
                      <EmptyState
                        icon={<Terminal className="w-8 h-8 text-[var(--text-tertiary)]" />}
                        title="No logs found"
                        description="Run simulations to generate logs."
                        stamp="EMPTY"
                      />
                    ) : (
                      <div className="divide-y divide-[var(--border-subtle)]">
                        {logs.map((log) => {
                          const Icon = levelIcons[log.level] || Info;
                          const isExpanded = expandedLog === log.id;
                          return (
                            <div key={log.id} className={cn('px-4 py-1.5 hover:bg-[var(--surface-container-lowest)] cursor-pointer transition-colors', levelBgColors[log.level])}>
                              <div className="flex items-start gap-2" onClick={() => setExpandedLog(isExpanded ? null : log.id)}>
                                <span className={cn('flex-shrink-0 mt-0.5', levelColors[log.level])}>
                                  <Icon className="w-3 h-3" />
                                </span>
                                <span className="flex-shrink-0 text-[var(--text-secondary)] font-mono w-36">{log.timestamp}</span>
                                <span className={cn('flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium uppercase', categoryColors[log.category])}>
                                  {log.category}
                                </span>
                                <span className="flex-shrink-0 w-12 text-center text-[var(--text-secondary)] ">{log.level.toUpperCase()}</span>
                                <span className="flex-1 text-[var(--text-secondary)]  break-all">{log.message}</span>
                              </div>
                              {isExpanded && log.details && (
                                <div className="mt-2 ml-6 p-2 bg-[var(--surface-container-lowest)] rounded border border-[var(--border-subtle)]  text-[var(--text-secondary)]  text-xs">
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
                </DashboardCard>
              </PageSection>
            </motion.div>

            {stats && (
              <motion.div variants={item}>
                <PageSection title="Level Distribution">
                  <Card>
                    <div className="p-4">
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(stats.byLevel || {}).map(([level, count]) => {
                          const Icon = levelIcons[level] || Info;
                          return (
                            <button key={level} onClick={() => handleLevelFilter(level)}
                              className={cn('inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                                filters.level === level
                                  ? 'bg-amber-500/10 border-amber-500/50 text-amber-600 '
                                  : 'bg-[var(--surface-container-lowest)]  border-[var(--border-subtle)]  text-[var(--text-secondary)]  hover:bg-[var(--surface-container-low)] '
                              )}>
                              <Icon className="w-3 h-3" />
                              {level}: <span className="font-bold">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                </PageSection>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </PageContainer>
  );
}

export default LogsPage;
