/**
 * Intelligence Dashboard — Mission Control
 * Live sandbox sessions, AI threat classification, telemetry activity,
 * blockchain integrity, recent evidence and reports, plus in-dashboard
 * investigation creation.
 */

import { useEffect, useMemo, useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, FileText, Activity, Plus, ArrowUpRight, Shield,
  Cpu, Brain, Link2, Clock, BarChart3, CheckCircle2, AlertTriangle,
  Trash2, Loader2,
  type LucideIcon,
} from 'lucide-react';
import { useInvestigationStore } from '../stores/investigationStore';
import { useSandboxStore } from '../stores/sandboxStore';
import { useThreatIntelStore } from '../stores/threatIntelStore';
import { useEvidenceStore } from '../stores/evidenceStore';
import { useReportsStore } from '../stores/reportsStore';
import { useBlockchainStore } from '../stores/blockchainStore';
import { useStatusStore } from '../stores/statusStore';
import { Modal } from '../components/ui/Modal';
import { cn } from '../design-system';
import { formatDateTime } from '../utils/helpers';

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const } },
};

// ─────────────────────────────────────────────────────────────────
// KPI Tile
// ─────────────────────────────────────────────────────────────────
interface KPITileProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  trend?: string;
  accent?: 'amber' | 'rose' | 'violet' | 'emerald' | 'sky';
  onClick?: () => void;
}

const accentMap: Record<string, { icon: string; dot: string }> = {
  amber: { icon: 'text-amber-600  ', dot: 'bg-amber-500' },
  rose: { icon: 'text-rose-600  ', dot: 'bg-rose-500' },
  violet: { icon: 'text-violet-600  ', dot: 'bg-violet-500' },
  emerald: { icon: 'text-emerald-600  ', dot: 'bg-emerald-500' },
  sky: { icon: 'text-sky-600  ', dot: 'bg-sky-500' },
};

const KPITile = memo(({ label, value, icon: Icon, trend, accent = 'amber', onClick }: KPITileProps) => {
  const colors = accentMap[accent] || accentMap.amber;
  return (
    <motion.button
      variants={fadeUp}
      onClick={onClick}
      className="group text-left p-5 w-full rounded-xl transition-all duration-200"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-strong)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('w-1 h-4 rounded-full', colors.dot)} />
          <span className="text-[13px] font-semibold tracking-tight" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </span>
        </div>
        <Icon strokeWidth={1.5} className={cn('w-4 h-4 transition-opacity', colors.icon, 'opacity-60 group-hover:opacity-100')} />
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="font-display text-3xl font-semibold tracking-tight tabular-nums"
          style={{ color: 'var(--text-primary)' }}
        >
          {value}
        </span>
        {trend && (
          <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
            {trend}
          </span>
        )}
      </div>
      <div
        className="mt-3 flex items-center gap-1.5 text-[12px] font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        View details
        <ArrowUpRight strokeWidth={1.5} className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </motion.button>
  );
});
KPITile.displayName = 'KPITile';

// ─────────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────────
interface SectionProps {
  title: string;
  meta?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const Section = memo(({ title, meta, action, children, className }: SectionProps) => (
  <motion.section variants={fadeUp} className={cn('p-5 rounded-xl', className)}
    style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-subtle)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}
  >
    <header className="flex items-center justify-between mb-4">
      <div>
        <h2
          className="font-display text-[15px] font-semibold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h2>
        {meta && <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{meta}</p>}
      </div>
      {action}
    </header>
    {children}
  </motion.section>
));
Section.displayName = 'Section';

// ─────────────────────────────────────────────────────────────────
// Badges & helpers
// ─────────────────────────────────────────────────────────────────
const severityColors: Record<string, string> = {
  critical: 'bg-red-100  text-red-600   border-red-500/30',
  high: 'bg-orange-100  text-orange-600   border-orange-500/30',
  medium: 'bg-amber-100  text-amber-600   border-amber-500/30',
  low: 'bg-emerald-100  text-emerald-600   border-emerald-500/30',
  info: 'bg-[var(--surface-container-low)]  text-[var(--text-secondary)]  border-[var(--border-default)]',
};

const SeverityBadge = ({ severity }: { severity: string }) => (
  <span
    className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border uppercase tracking-wide flex-shrink-0',
      severityColors[severity] || severityColors.info
    )}
  >
    {severity || 'n/a'}
  </span>
);

const statusDotColor: Record<string, string> = {
  running: 'bg-emerald-500',
  active: 'bg-emerald-500',
  completed: 'bg-sky-500',
  pending: 'bg-amber-500',
  failed: 'bg-red-500',
  error: 'bg-red-500',
};

const StatusDot = ({ status }: { status: string }) => (
  <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
    {(status === 'running' || status === 'active') && (
      <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping', statusDotColor[status])} />
    )}
    <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', statusDotColor[status] || 'bg-slate-400')} />
  </span>
);

// ─────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────
export function EnhancedDashboardPage() {
  const navigate = useNavigate();
  const { investigations, fetchInvestigations, createInvestigation, deleteInvestigation } = useInvestigationStore();
  const { sessions, stats: sandboxStats, fetchSessions, fetchStats } = useSandboxStore();
  const { analysisHistory, loadHistory: loadThreatHistory } = useThreatIntelStore();
  const { evidence, fetchEvidence } = useEvidenceStore();
  const { reports, fetchReports } = useReportsStore();
  const { status: chainStatus, stats: chainStats, fetchStatus, fetchStats: fetchChainStats } = useBlockchainStore();
  const showStatus = useStatusStore((s) => s.show);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvestigations({ page: 1, limit: 10 });
    fetchSessions({ page: 1, limit: 10 });
    fetchStats();
    loadThreatHistory();
    fetchEvidence({ page: 1, limit: 5 });
    fetchReports();
    fetchStatus();
    fetchChainStats();
  }, [fetchInvestigations, fetchSessions, fetchStats, loadThreatHistory, fetchEvidence, fetchReports, fetchStatus, fetchChainStats]);

  const runningSessions = sandboxStats?.byStatus?.running || sessions.filter(s => (s.status || '') === 'running').length;
  const totalEvidence = chainStats?.totalEvidence || evidence.length;
  const threatDetections = analysisHistory.filter(
    a => ['high', 'critical', 'medium', 'malicious', 'suspicious'].includes((a.threatLevel || '').toLowerCase())
  ).length;

  const threatLevels = useMemo(() => {
    const order = ['critical', 'high', 'medium', 'low', 'benign'];
    const counts = order.map(level => ({
      level,
      count: analysisHistory.filter(a => (a.threatLevel || '').toLowerCase() === level).length,
    }));
    const total = counts.reduce((acc, c) => acc + c.count, 0);
    return { counts, total };
  }, [analysisHistory]);
  const maxThreatCount = Math.max(...threatLevels.counts.map(c => c.count), 1);

  const last7Days = useMemo(() => {
    const days: { label: string; events: number; reports: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayReports = reports.filter(r => r.generatedAt?.startsWith(key));
      days.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        events: dayReports.reduce((acc, r) => acc + (r.totalEvents || 0), 0),
        reports: dayReports.length,
      });
    }
    return days;
  }, [reports]);
  const maxDayEvents = Math.max(...last7Days.map(d => d.events), 1);

  const handleCreateInvestigation = async () => {
    if (!newTitle.trim()) {
      setCreateError('Please enter a case title.');
      return;
    }
    setCreateError('');
    setIsCreating(true);
    try {
      await createInvestigation({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        priority: newPriority as 'low' | 'medium' | 'high' | 'critical',
      });
      handleCloseCreateModal();
    } catch {
      setCreateError('Failed to create investigation. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setNewTitle('');
    setNewDescription('');
    setNewPriority('medium');
    setCreateError('');
  };

  const handleDeleteInvestigation = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteInvestigation(id);
      setConfirmDeleteId(null);
      showStatus('success', 'Investigation deleted', 'Case and its evidence, sessions and reports were removed.', 6000);
    } catch {
      showStatus('error', 'Delete failed', 'Could not delete the investigation. Check your permissions.', 8000);
    } finally {
      setDeletingId(null);
    }
  };

  const chainHealthy = chainStatus?.available !== false;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="relative max-w-[1440px] mx-auto"
    >
      <div className="relative z-10 space-y-6">
        {/* ─── Header ─── */}
        <motion.div variants={fadeUp} className="flex items-end justify-between gap-4 flex-wrap pt-2">
          <div>
            <p className="eyebrow mb-1.5">
              Operations · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1
                className="font-display text-[32px] font-semibold tracking-[-0.02em] leading-none"
                style={{ color: 'var(--text-primary)' }}
              >
                Intelligence Dashboard
              </h1>
              <span className="stamp">REALTIME</span>
            </div>
            <p className="text-[13px] mt-2" style={{ color: 'var(--text-secondary)' }}>
              Real-time posture across sandbox sessions, AI analysis, evidence and blockchain integrity
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/reports')}
              className="h-9 px-3.5 inline-flex items-center gap-2 text-[13px] font-medium rounded-md transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-container)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <BarChart3 strokeWidth={1.5} className="w-4 h-4" />
              Reports
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="h-9 px-3.5 inline-flex items-center gap-2 text-[13px] font-medium rounded-md text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)' }}
            >
              <Plus strokeWidth={1.75} className="w-4 h-4" />
              New Investigation
            </button>
          </div>
        </motion.div>

        {/* ─── KPI Row ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KPITile
            label="Active Cases"
            value={investigations.length}
            icon={Search}
            trend={`${investigations.filter(i => i.status === 'active').length} active`}
            accent="amber"
            onClick={() => setShowCreateModal(true)}
          />
          <KPITile
            label="Evidence Items"
            value={totalEvidence}
            icon={FileText}
            trend={chainStats ? `${chainStats.verified} verified` : 'Across cases'}
            accent="violet"
            onClick={() => navigate('/evidence')}
          />
          <KPITile
            label="Sandbox Sessions"
            value={sandboxStats?.total || sessions.length}
            icon={Activity}
            trend={`${runningSessions} running`}
            accent="emerald"
            onClick={() => navigate('/sandbox')}
          />
          <KPITile
            label="Threat Detections"
            value={threatDetections}
            icon={AlertTriangle}
            trend={threatDetections > 0 ? 'AI-flagged artifacts' : 'No threats'}
            accent="rose"
            onClick={() => navigate('/ai-analysis')}
          />
          <KPITile
            label="On-Chain Evidence"
            value={chainStats?.blockchainOnChain ?? chainStats?.verified ?? '—'}
            icon={Shield}
            trend={`${chainStats?.tamperAlerts || 0} tamper alerts`}
            accent="sky"
            onClick={() => navigate('/blockchain-operations')}
          />
        </div>

        {/* ─── Active Investigations ─── */}
        <Section
          title="Active Investigations"
          meta={`${investigations.length} cases loaded`}
          action={
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-[12px] font-medium transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              New case →
            </button>
          }
        >
          {investigations.length === 0 ? (
            <div className="py-10 text-center">
              <Search strokeWidth={1.5} className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No investigations yet</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-3 text-[12px] font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                Create your first investigation →
              </button>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {investigations.map((inv, i) => (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.04, duration: 0.24 }}
                  className="py-3"
                >
                  {confirmDeleteId === inv.id ? (
                    <div className="flex items-center gap-3 rounded-lg px-2 py-1" style={{ background: 'var(--surface-container)' }}>
                      <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      <p className="text-[12px] flex-1" style={{ color: 'var(--text-secondary)' }}>
                        Delete case <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{inv.caseNumber}</span> and all of its evidence, sessions and reports?
                      </p>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[12px] font-medium px-2 py-1 rounded-md transition-colors"
                        style={{ color: 'var(--text-tertiary)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteInvestigation(inv.id)}
                        disabled={deletingId === inv.id}
                        className="text-[12px] font-medium px-2.5 py-1 rounded-md text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        style={{ background: '#e11d48' }}
                      >
                        {deletingId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Delete'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-1">
                      <StatusDot status={(inv.status || 'active') as string} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {inv.title || 'Untitled case'}
                        </p>
                        <p className="text-[11px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {inv.caseNumber} · {(inv.evidenceCount ?? 0)} evidence · {inv.status || 'active'}
                        </p>
                      </div>
                      <button
                        onClick={() => setConfirmDeleteId(inv.id)}
                        title="Delete investigation"
                        className="p-1.5 rounded-md transition-colors"
                        style={{ color: 'var(--text-tertiary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#f43f5e';
                          e.currentTarget.style.background = 'var(--surface-container)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-tertiary)';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <Trash2 strokeWidth={1.75} className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </Section>

        {/* ─── Row: Sandbox Sessions + Threat Classification ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section
            title="Live Sandbox Sessions"
            meta={`${sandboxStats?.total || sessions.length} total · ${runningSessions} running`}
            action={
              <button
                onClick={() => navigate('/sandbox')}
                className="text-[12px] font-medium transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                View all →
              </button>
            }
          >
            {sessions.length === 0 ? (
              <div className="py-10 text-center">
                <Cpu strokeWidth={1.5} className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No sandbox sessions yet</p>
                <button
                  onClick={() => navigate('/sandbox')}
                  className="mt-3 text-[12px] font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Launch a session →
                </button>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {sessions.slice(0, 6).map((session, i) => (
                  <motion.button
                    key={session.id || session.sessionId || i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.04, duration: 0.24 }}
                    onClick={() => navigate('/sandbox')}
                    className="w-full flex items-center gap-3 py-3 px-1 -mx-1 rounded-md transition-colors text-left group"
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-container)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <StatusDot status={session.status || 'pending'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {session.simulatorName || session.simulatorId || session.vmName || 'Sandbox session'}
                      </p>
                      <p className="text-[11px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                        {session.sessionId ? session.sessionId.slice(0, 16) : session.id}
                      </p>
                    </div>
                    <span
                      className="text-[11px] font-medium capitalize flex-shrink-0"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {session.status || 'pending'}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Threat Classification"
            meta={`${threatLevels.total} analyzed artifacts`}
            action={
              <button
                onClick={() => navigate('/ai-analysis')}
                className="text-[12px] font-medium transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                AI Analysis →
              </button>
            }
          >
            {threatLevels.total === 0 ? (
              <div className="py-10 text-center">
                <Brain strokeWidth={1.5} className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No analyses yet</p>
                <button
                  onClick={() => navigate('/ai-analysis')}
                  className="mt-3 text-[12px] font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Run an analysis →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {threatLevels.counts.map((item) => (
                  <div key={item.level} className="flex items-center gap-3">
                    <span className="text-[12px] font-medium w-16 capitalize" style={{ color: 'var(--text-tertiary)' }}>
                      {item.level}
                    </span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-container)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.count / maxThreatCount) * 100}%` }}
                        transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className={cn('h-full rounded-full', {
                          'bg-red-500': item.level === 'critical',
                          'bg-orange-500': item.level === 'high',
                          'bg-amber-500': item.level === 'medium',
                          'bg-sky-500': item.level === 'low',
                          'bg-emerald-500': item.level === 'benign',
                        })}
                      />
                    </div>
                    <span className="text-[12px] font-medium w-6 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* ─── Row: Telemetry + Blockchain ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section
            title="Telemetry Activity"
            meta="Events captured per day · last 7 days"
            action={
              <button
                onClick={() => navigate('/telemetry')}
                className="text-[12px] font-medium transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                Live Telemetry →
              </button>
            }
          >
            {last7Days.every(d => d.events === 0) ? (
              <div className="py-10 text-center">
                <BarChart3 strokeWidth={1.5} className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No telemetry events in the last 7 days</p>
                <button
                  onClick={() => navigate('/sandbox')}
                  className="mt-3 text-[12px] font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Run a sandbox session →
                </button>
              </div>
            ) : (
              <div className="flex items-end gap-2 h-36">
                {last7Days.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span
                      className="text-[11px] font-mono tabular-nums"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {day.events > 0 ? day.events : ''}
                    </span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(day.events / maxDayEvents) * 100}%` }}
                      transition={{ duration: 0.5, delay: 0.2 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                      className={cn('w-full max-w-[36px] rounded-t-md', day.events > 0 ? 'bg-amber-500' : 'bg-[var(--surface-container)] ')}
                    />
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      {day.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Blockchain Integrity"
            meta={chainHealthy ? 'Ledger connection operational' : 'Ledger connection degraded'}
            action={
              <button
                onClick={() => navigate('/blockchain-operations')}
                className="text-[12px] font-medium transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                Blockchain Ops →
              </button>
            }
          >
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg" style={{ background: 'var(--surface-container)' }}>
                <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>Verified evidence</p>
                <p className="text-xl font-semibold tabular-nums mt-0.5" style={{ color: 'var(--text-primary)' }}>
                  {chainStats?.verified ?? '—'}
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--surface-container)' }}>
                <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>On-chain anchored</p>
                <p className="text-xl font-semibold tabular-nums mt-0.5" style={{ color: 'var(--text-primary)' }}>
                  {chainStats?.blockchainOnChain ?? '—'}
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--surface-container)' }}>
                <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>Modified / tampered</p>
                <p className="text-xl font-semibold tabular-nums mt-0.5" style={{ color: 'var(--text-primary)' }}>
                  {chainStats?.modified ?? '—'}
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--surface-container)' }}>
                <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>Tamper alerts</p>
                <p className="text-xl font-semibold tabular-nums mt-0.5" style={{ color: 'var(--text-primary)' }}>
                  {chainStats?.tamperAlerts ?? '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusDot status={chainHealthy ? 'running' : 'failed'} />
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  {chainHealthy ? 'Ledger connected' : 'Ledger unreachable'}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600  ">
                <CheckCircle2 className="w-4 h-4" />
                Tamper-evident
              </span>
            </div>
          </Section>
        </div>

        {/* ─── Row: Recent Evidence + Recent Reports ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section
            title="Recent Evidence"
            meta={`${evidence.length} latest items`}
            action={
              <button
                onClick={() => navigate('/evidence')}
                className="text-[12px] font-medium transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                Evidence Explorer →
              </button>
            }
          >
            {evidence.length === 0 ? (
              <div className="py-10 text-center">
                <FileText strokeWidth={1.5} className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No evidence collected yet</p>
                <button
                  onClick={() => navigate('/sandbox')}
                  className="mt-3 text-[12px] font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Collect evidence from a sandbox session →
                </button>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {evidence.slice(0, 5).map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.04, duration: 0.24 }}
                    className="flex items-center gap-3 py-3"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-container)' }}>
                      <FileText strokeWidth={1.5} className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.name}
                      </p>
                      <p className="text-[11px] mt-0.5 flex items-center gap-1 truncate" style={{ color: 'var(--text-tertiary)' }}>
                        <Clock className="w-3 h-3" />
                        {formatDateTime(item.collectedAt)}
                      </p>
                    </div>
                    <SeverityBadge severity={(item.status || '').toLowerCase()} />
                  </motion.div>
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Recent Reports"
            meta={`${reports.length} forensic reports`}
            action={
              <button
                onClick={() => navigate('/reports')}
                className="text-[12px] font-medium transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                View all →
              </button>
            }
          >
            {reports.length === 0 ? (
              <div className="py-10 text-center">
                <BarChart3 strokeWidth={1.5} className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No reports generated yet</p>
                <button
                  onClick={() => navigate('/reports')}
                  className="mt-3 text-[12px] font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  View reports →
                </button>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {reports.slice(0, 5).map((report, i) => {
                  const maxSeverity = Object.entries(report.severityCounts || {})
                    .sort((a, b) => b[1] - a[1])[0]?.[0];
                  return (
                    <motion.button
                      key={report.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.04, duration: 0.24 }}
                      onClick={() => navigate('/reports')}
                      className="w-full flex items-center gap-3 py-3 px-1 -mx-1 rounded-md transition-colors text-left group"
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-container)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-container)' }}>
                        <FileText strokeWidth={1.5} className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {report.simulatorName}
                        </p>
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {formatDateTime(report.generatedAt)} · {report.totalEvents} events
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {report.blockchainVerified && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600  ">
                            <Link2 className="w-3 h-3" />
                            Anchored
                          </span>
                        )}
                        <SeverityBadge severity={maxSeverity || 'info'} />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </Section>
        </div>

        {/* ─── System Status ─── */}
        <motion.div variants={fadeUp} className="p-5 rounded-xl"
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <StatusDot status="running" />
                <span className="text-[13px] font-semibold tracking-tight" style={{ color: 'var(--text-secondary)' }}>
                  System Status
                </span>
              </div>
              <div className="flex items-center gap-8 text-[12px]">
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>Backend</span>
                  <span className="ml-2 font-medium text-emerald-600  ">Operational</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>AI Engine</span>
                  <span className="ml-2 font-medium text-emerald-600  ">Operational</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>Sandbox</span>
                  <span className="ml-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    {runningSessions > 0 ? `${runningSessions} running` : 'Standby'}
                  </span>
                </div>
              </div>
            </div>
            <span className="text-[12px] font-medium tracking-tight" style={{ color: 'var(--text-tertiary)' }}>
              v2.0 · Enterprise
            </span>
          </div>
        </motion.div>
      </div>

      {/* ─── New Investigation Modal ─── */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        title="New Investigation"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Case Title <span className="text-red-500">*</span>
            </label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Phishing campaign targeting bank customers"
              className="w-full px-3 py-2 text-sm rounded-lg border"
              style={{ background: 'var(--surface-container)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Description
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              placeholder="What happened? Which artifacts are involved?"
              className="w-full px-3 py-2 text-sm rounded-lg border resize-none"
              style={{ background: 'var(--surface-container)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Priority
            </label>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border"
              style={{ background: 'var(--surface-container)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          {createError && (
            <p className="text-[13px] text-red-600  ">{createError}</p>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={handleCloseCreateModal}
              className="px-4 py-2 text-[13px] font-medium rounded-lg transition-colors"
              style={{ background: 'var(--surface-container)', color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateInvestigation}
              disabled={isCreating}
              className="px-4 py-2 text-[13px] font-medium rounded-lg text-white shadow-sm transition-opacity disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)' }}
            >
              {isCreating ? 'Creating…' : 'Create Investigation'}
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}

export default EnhancedDashboardPage;
