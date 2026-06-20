/**
 * Intelligence Dashboard — Editorial Dark
 * Warm dark surfaces, cream typography, amber accent.
 * Bento grid: 4 KPI tiles + 2:1 investigations/alerts split + status footer.
 */

import { useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, AlertTriangle, FileText, Activity, Plus, ArrowUpRight,
  TrendingUp, Bell, Shield, type LucideIcon,
} from 'lucide-react';
import { useInvestigationStore } from '../stores/investigationStore';
import { useAlertStore } from '../stores/alertStore';
import { useSandboxStore } from '../stores/sandboxStore';
import { useThreatIntelStore } from '../stores/threatIntelStore';
import { cn } from '../design-system';

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 8 },
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
  accent?: 'amber' | 'rose' | 'violet' | 'emerald';
  onClick?: () => void;
}

const accentMap = {
  amber: { icon: 'text-amber-400', dot: 'bg-amber-500' },
  rose: { icon: 'text-rose-400', dot: 'bg-rose-500' },
  violet: { icon: 'text-violet-400', dot: 'bg-violet-500' },
  emerald: { icon: 'text-emerald-400', dot: 'bg-emerald-500' },
};

const KPITile = memo(({ label, value, icon: Icon, trend, accent = 'amber', onClick }: KPITileProps) => {
  const colors = accentMap[accent];
  return (
    <motion.button
      variants={fadeUp}
      onClick={onClick}
      className="group text-left p-5 w-full rounded-xl transition-all duration-200"
      style={{
        background: 'var(--surface-overlay)',
        backdropFilter: 'blur(16px) saturate(1.1)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
        e.currentTarget.style.background = 'rgba(0,0,0,0.75)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
        e.currentTarget.style.background = 'var(--surface-overlay)';
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn('w-1 h-4 rounded-full', colors.dot)} />
          <span className="overline">{label}</span>
        </div>
        <Icon strokeWidth={1.5} className={cn('w-4 h-4 transition-opacity', colors.icon, 'opacity-50 group-hover:opacity-100')} />
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="font-display text-3xl font-semibold tracking-tight tabular-nums"
          style={{ color: 'var(--text-primary)' }}
        >
          {value}
        </span>
        {trend && (
          <span className="text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
            {trend}
          </span>
        )}
      </div>
      <div className="mt-4 h-px" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.08), transparent)' }} />
      <div
        className="mt-3 flex items-center gap-1.5 text-[11px] font-medium"
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
      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
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
        {meta && <p className="overline mt-1">{meta}</p>}
      </div>
      {action}
    </header>
    {children}
  </motion.section>
));
Section.displayName = 'Section';

// ─────────────────────────────────────────────────────────────────
// Severity Badge
// ─────────────────────────────────────────────────────────────────
const severityColors: Record<string, string> = {
  critical: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  high: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  low: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  info: 'bg-white/5 text-[#a09b93] border-white/10',
};

const SeverityBadge = ({ severity }: { severity: string }) => (
  <span
    className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium border uppercase tracking-wider',
      severityColors[severity] || severityColors.info
    )}
  >
    {severity}
  </span>
);

// ─────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────
export function EnhancedDashboardPage() {
  const navigate = useNavigate();
  const { investigations, fetchInvestigations } = useInvestigationStore();
  const { alerts, fetchAlerts } = useAlertStore();
  const { stats: sandboxStats, fetchSessions, fetchStats } = useSandboxStore();
  const { analysisHistory, loadHistory: loadThreatHistory } = useThreatIntelStore();

  useEffect(() => {
    fetchInvestigations({ page: 1, limit: 5 });
    fetchAlerts({ page: 1, limit: 5 });
    fetchSessions({ page: 1, limit: 20 });
    fetchStats();
    loadThreatHistory();
  }, [fetchInvestigations, fetchAlerts, fetchSessions, fetchStats, loadThreatHistory]);

  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const activeInvestigations = investigations.length;
  const totalEvidence = investigations.reduce((acc, inv) => acc + (inv.evidenceCount || 0), 0);
  const runningSessions = sandboxStats?.byStatus?.running || 0;
  // Threat detections: count of analyses (PDF/Word/URL) flagged as suspicious or worse + high-severity alerts
  const threatDetections = analysisHistory.filter(
    a => ['high', 'critical', 'medium', 'malicious', 'suspicious'].includes((a.threatLevel || '').toLowerCase())
  ).length + alerts.filter(a => ['critical', 'high'].includes(a.severity)).length;

  const severityDist = [
    { severity: 'critical', count: alerts.filter(a => a.severity === 'critical').length, color: 'bg-rose-500' },
    { severity: 'high', count: alerts.filter(a => a.severity === 'high').length, color: 'bg-orange-500' },
    { severity: 'medium', count: alerts.filter(a => a.severity === 'medium').length, color: 'bg-amber-500' },
    { severity: 'low', count: alerts.filter(a => a.severity === 'low').length, color: 'bg-emerald-500' },
  ];
  const maxCount = Math.max(...severityDist.map(s => s.count), 1);

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="relative max-w-[1440px] mx-auto"
    >
      <div className="relative z-10 space-y-6">
        {/* ─── Header ─── */}
        <motion.div variants={fadeUp} className="flex items-end justify-between pt-2">
          <div>
            <p className="overline mb-1.5">
              Operations · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <h1
              className="font-display text-[32px] font-semibold tracking-[-0.02em] leading-none"
              style={{ color: 'var(--text-primary)' }}
            >
              Intelligence Dashboard
            </h1>
            <p className="text-[13px] mt-2" style={{ color: 'var(--text-secondary)' }}>
              Real-time threat posture across {activeInvestigations} active investigations
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
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <TrendingUp strokeWidth={1.5} className="w-4 h-4" />
              Reports
            </button>
            <button
              onClick={() => navigate('/investigations')}
              className="h-9 px-3.5 inline-flex items-center gap-2 text-[13px] font-medium rounded-md text-white shadow-sm transition-colors"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)' }}
            >
              <Plus strokeWidth={1.75} className="w-4 h-4" />
              New Investigation
            </button>
          </div>
        </motion.div>

        {/* ─── KPI Row ─── */}
        <div className="grid grid-cols-5 gap-4">
          <KPITile
            label="Active Cases"
            value={activeInvestigations}
            icon={Search}
            trend={`${investigations.filter(i => i.status === 'active').length} active`}
            accent="amber"
            onClick={() => navigate('/investigations')}
          />
          <KPITile
            label="Critical Alerts"
            value={criticalAlerts}
            icon={AlertTriangle}
            trend={criticalAlerts > 0 ? 'Action required' : 'All clear'}
            accent="rose"
            onClick={() => navigate('/alerts')}
          />
          <KPITile
            label="Evidence Items"
            value={totalEvidence}
            icon={FileText}
            trend="Across cases"
            accent="violet"
            onClick={() => navigate('/evidence')}
          />
          <KPITile
            label="Sandbox Sessions"
            value={sandboxStats?.total || 0}
            icon={Activity}
            trend={`${runningSessions} running`}
            accent="emerald"
            onClick={() => navigate('/sandbox')}
          />
          <KPITile
            label="Threat Detections"
            value={threatDetections}
            icon={Shield}
            trend={threatDetections > 0 ? 'Detected threats' : 'No threats'}
            accent="rose"
            onClick={() => navigate('/threat-intelligence')}
          />
        </div>

        {/* ─── Bento: Investigations + Alerts ─── */}
        <div className="grid grid-cols-3 gap-4">
          <Section
            title="Active Investigations"
            meta={`${investigations.length} cases · Last 7 days`}
            action={
              <button
                onClick={() => navigate('/investigations')}
                className="text-[11px] font-mono font-medium uppercase tracking-wider transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                View All →
              </button>
            }
            className="col-span-2"
          >
            {investigations.length === 0 ? (
              <div className="py-12 text-center">
                <div
                  className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <Search strokeWidth={1.5} className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                </div>
                <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No active investigations</p>
                <button
                  onClick={() => navigate('/investigations')}
                  className="mt-3 text-[12px] font-medium transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Create your first case →
                </button>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {investigations.slice(0, 5).map((inv, i) => (
                  <motion.button
                    key={inv.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.04, duration: 0.24 }}
                    onClick={() => navigate(`/investigations/${inv.id}`)}
                    className="w-full flex items-center gap-3 py-3 px-1 -mx-1 rounded-md transition-colors text-left group"
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[13px] font-medium truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {inv.title}
                      </p>
                      <p
                        className="text-[11px] font-mono mt-0.5 truncate"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {inv.caseNumber}
                      </p>
                    </div>
                    <SeverityBadge severity={inv.priority || 'info'} />
                  </motion.button>
                ))}
              </div>
            )}
          </Section>

          <Section title="Alert Distribution" meta={`${alerts.length} total events`}>
            <div className="space-y-3 mb-5">
              {severityDist.map((item) => (
                <div key={item.severity} className="flex items-center gap-3">
                  <span
                    className="text-[10px] font-mono w-12 capitalize"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {item.severity}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.count / maxCount) * 100}%` }}
                      transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className={cn('h-full rounded-full', item.color)}
                    />
                  </div>
                  <span
                    className="text-[11px] font-mono font-medium w-6 text-right tabular-nums"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {item.count}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {alerts.slice(0, 3).map((alert, i) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 + i * 0.04 }}
                  className="flex items-center gap-2 py-1"
                >
                  <Bell strokeWidth={1.5} className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                  <span className="text-[12px] truncate flex-1" style={{ color: 'var(--text-secondary)' }}>
                    {alert.title}
                  </span>
                  <SeverityBadge severity={alert.severity || 'info'} />
                </motion.div>
              ))}
              {alerts.length === 0 && (
                <p className="text-[12px] text-center py-2" style={{ color: 'var(--text-tertiary)' }}>
                  No alerts to display
                </p>
              )}
            </div>
          </Section>
        </div>

        {/* ─── System Status ─── */}
        <motion.div variants={fadeUp} className="p-5 rounded-xl"
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="relative w-1.5 h-1.5 rounded-full bg-emerald-400">
                  <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                </div>
                <span className="overline">System Status</span>
              </div>
              <div className="flex items-center gap-8 text-[12px]">
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>Backend</span>
                  <span className="ml-2 font-mono text-emerald-400 font-medium">Operational</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>AI Engine</span>
                  <span className="ml-2 font-mono text-emerald-400 font-medium">Operational</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>Sandbox</span>
                  <span className="ml-2 font-mono font-medium" style={{ color: 'var(--text-tertiary)' }}>Standby</span>
                </div>
              </div>
            </div>
            <span className="overline">v2.0 · Enterprise</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default EnhancedDashboardPage;
