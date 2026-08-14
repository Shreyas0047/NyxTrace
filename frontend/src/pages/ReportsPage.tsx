/**
 * Reports Page — Unified Forensic Analytics Hub
 * Detailed analytics and graphs of AI analysis across sandbox sessions,
 * document analyses, URL analyses, and execution report files.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  Clock,
  AlertTriangle,
  Shield,
  Activity,
  Hash,
  Globe,
  Terminal,
  Brain,
  Loader2,
  FileSearch,
  XCircle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { PageHeader, PageGrid } from '../layouts/PageContainer';
import { DashboardCard, DashboardStat } from '../components/enterprise/DashboardGrid';
import { formatDateTime, formatDuration, formatFileSize } from '../utils/helpers';
import { cn } from '../design-system';
import { useReportsStore } from '../stores/reportsStore';
import { RiskScoreGauge } from '../components/visualizations/RiskScoreGauge';
import { CategoryDistributionChart } from '../components/visualizations/CategoryDistributionChart';
import { EventTimelineChart, type TimelinePoint } from '../components/visualizations/EventTimelineChart';
import { VerdictBanner } from '../components/threat-intelligence/VerdictBanner';
import api from '../services/api';
import type { AnalysisReportItem, SandboxSessionWithExtras, SandboxSessionEvent } from '../types';
import type { ForensicReportDetail } from '../types/reports';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };

const severityColors: Record<string, string> = {
  critical: 'bg-red-100  text-red-600  ',
  high: 'bg-orange-100  text-orange-600  ',
  medium: 'bg-amber-100  text-amber-600  ',
  low: 'bg-emerald-100  text-emerald-600  ',
  info: 'bg-blue-100  text-blue-600 ',
};

const categoryIcons: Record<string, typeof Activity> = {
  process: Activity,
  file: FileText,
  registry: Hash,
  network: Activity,
  behavior: Shield,
  system: AlertTriangle,
};

const categoryColors: Record<string, string> = {
  process: 'bg-amber-500/15 text-amber-600 ',
  file: 'bg-violet-100  text-violet-600  ',
  registry: 'bg-amber-100  text-amber-600  ',
  network: 'bg-blue-100  text-blue-600 ',
  behavior: 'bg-orange-100  text-orange-600  ',
  system: 'bg-[var(--surface-container-low)]  text-[var(--text-secondary)] ',
};

const categoryBarColors: Record<string, string> = {
  process: '#f59e0b',
  file: '#8b5cf6',
  registry: '#d97706',
  network: '#3b82f6',
  system: '#64748b',
  behavior: '#ea580c',
  wmi: '#06b6d4',
};

type SourceTab = 'sessions' | 'documents' | 'urls' | 'execution';
type DetailTab = 'case-report' | 'timeline' | 'events' | 'suspicious' | 'summary' | 'ai-analysis' | 'sandbox-findings';

type ViewState =
  | { kind: 'execution'; id: string }
  | { kind: 'sandbox'; session: SandboxSessionWithExtras }
  | { kind: 'analysis'; item: AnalysisReportItem }
  | null;

const InfoTile = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="p-3 bg-[var(--surface-container-lowest)]  rounded-lg">
    <p className="text-xs text-[var(--text-secondary)] ">{label}</p>
    <p className="text-sm font-medium text-[var(--text-primary)]  mt-0.5 break-words">{value}</p>
  </div>
);

const CaseRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4">
    <span className="text-[var(--text-secondary)]  flex-shrink-0">{label}</span>
    <span className="text-right text-[var(--text-primary)]  font-medium break-all">{value}</span>
  </div>
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function eventCategory(e: SandboxSessionEvent): string {
  const raw = String(e.type || '').toLowerCase();
  if (raw && raw !== 'unknown') return raw;
  const det = (e.details || {}) as Record<string, unknown>;
  const c = String(det.category || det.event_type || det.eventType || 'other').toLowerCase();
  return c || 'other';
}

function buildCategorySlices(session: SandboxSessionWithExtras) {
  const events = session.recentEvents || [];
  const counts: Record<string, number> = {};
  for (const e of events) {
    const cat = eventCategory(e);
    counts[cat] = (counts[cat] || 0) + 1;
  }
  const total = events.length;
  return {
    slices: Object.entries(counts).map(([category, count]) => ({
      category,
      count,
      color: categoryBarColors[category] || '#94a3b8',
    })),
    total,
  };
}

function buildTimeline(events: SandboxSessionEvent[], maxBuckets = 16): TimelinePoint[] {
  const valid = events
    .filter((e) => e.timestamp)
    .map((e) => ({ t: new Date(e.timestamp as string).getTime(), cat: eventCategory(e) }))
    .sort((a, b) => a.t - b.t);
  if (valid.length === 0) return [];
  const t0 = valid[0].t;
  const t1 = valid[valid.length - 1].t;
  const span = Math.max(60000, t1 - t0);
  const bucketCount = Math.min(maxBuckets, Math.max(1, Math.round(span / 60000)));
  const bucketMs = span / bucketCount;
  const fmt = (t: number) =>
    new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const points: TimelinePoint[] = Array.from({ length: bucketCount }, (_, i) => ({
    label: fmt(t0 + i * bucketMs),
    buckets: {},
  }));
  for (const ev of valid) {
    const idx = Math.min(bucketCount - 1, Math.floor((ev.t - t0) / bucketMs));
    points[idx].buckets[ev.cat] = (points[idx].buckets[ev.cat] || 0) + 1;
  }
  return points;
}

function classificationBars(ai: Record<string, number>) {
  return Object.entries(ai)
    .filter(([, v]) => typeof v === 'number')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
}

function threatLevelPill(level?: string) {
  if (!level) return null;
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium', severityColors[level] || severityColors.info)}>
      {String(level).toUpperCase()}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Detail components
// ---------------------------------------------------------------------------

function SandboxDetail({ session, onClose }: { session: SandboxSessionWithExtras; onClose: () => void }) {
  const ai = session.aiAnalysis;
  const { slices, total } = buildCategorySlices(session);
  const timeline = useMemo(() => buildTimeline(session.recentEvents || []), [session.recentEvents]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 bg-[var(--surface-container-lowest)]  rounded-lg">
        <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center">
          <Terminal className="w-6 h-6 text-violet-600 " />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[var(--text-primary)] ">{session.simulatorName}</p>
            {threatLevelPill(ai?.severity_level)}
            {!ai && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-600">
                AI analysis pending
              </span>
            )}
            <span className={cn('px-2 py-0.5 rounded text-[11px] font-medium',
              session.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
              session.status === 'failed' ? 'bg-red-100 text-red-600' :
              session.status === 'running' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600')}>
              {String(session.status || 'unknown').toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]   font-mono truncate">{session.sessionId}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}><XCircle className="w-4 h-4" /></Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
        <div className="md:col-span-1 p-4 bg-[var(--surface-container-lowest)]  rounded-lg flex flex-col items-center justify-center">
          <RiskScoreGauge score={ai?.severity_score ?? 0} size="sm" label="Risk Score" />
          {!ai && <p className="text-[11px] text-[var(--text-secondary)]  text-center mt-1">No AI score yet</p>}
        </div>
        <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InfoTile label="Confidence" value={ai?.confidence !== undefined ? `${Math.round(ai.confidence * 100)}%` : 'N/A'} />
          <InfoTile label="Total Events" value={ai?.total_events ?? session.eventsCollected ?? 0} />
          <InfoTile label="Suspicious Events" value={ai?.suspicious_events ?? session.suspiciousEvents?.length ?? 0} />
          <InfoTile label="Anomalies" value={Array.isArray(ai?.anomalies) ? ai!.anomalies.length : 'N/A'} />
          <InfoTile label="Duration" value={formatDuration(session.duration || 0)} />
          <InfoTile label="Analyzed At" value={ai?.analysis_timestamp ? formatDateTime(ai.analysis_timestamp) : 'N/A'} />
        </div>
      </div>

      {!ai && (
        <div className="p-3 rounded-lg border border-dashed border-amber-400/50 bg-amber-50/40 flex items-start gap-2">
          <Brain className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[var(--text-secondary)]">
            AI analysis has not been generated for this session yet. Event telemetry and session
            metadata are still available below; analysis is queued once the AI service completes processing.
          </p>
        </div>
      )}

      {ai?.threat_classification && Object.keys(ai.threat_classification).length > 0 && (
        <div className="p-4 bg-[var(--surface-container-lowest)]  rounded-lg">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-3">Threat Classification</p>
          <div className="space-y-2">
            {classificationBars(ai.threat_classification).map(([k, v]) => (
              <div key={k}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[var(--text-secondary)] font-medium capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="text-[var(--text-primary)] font-mono">{Math.round(v * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-container)] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(2, v * 100)}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={cn('h-full rounded-full', v >= 0.7 ? 'bg-red-500' : v >= 0.4 ? 'bg-orange-500' : v >= 0.15 ? 'bg-amber-500' : 'bg-slate-400')}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ai?.behavioral_summary && (
        <div className="p-4 bg-[var(--surface-container-lowest)]  rounded-lg">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-1">Behavioral Summary</p>
          <p className="text-sm text-[var(--text-secondary)] ">{ai.behavioral_summary}</p>
        </div>
      )}

      {Array.isArray(ai?.recommendations) && ai!.recommendations.length > 0 && (
        <div className="p-4 bg-[var(--surface-container-lowest)]  rounded-lg">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-1">Recommendations</p>
          <ul className="text-sm text-[var(--text-secondary)]  list-disc list-inside space-y-1">
            {ai!.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {Array.isArray(ai?.anomalies) && ai!.anomalies.length > 0 && (
        <div className="p-4 bg-[var(--surface-container-lowest)]  rounded-lg">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-1">Detected Anomalies</p>
          <ul className="text-sm text-[var(--text-secondary)]  list-disc list-inside space-y-1">
            {ai!.anomalies.map((a: unknown, i: number) => (
              <li key={i}>{typeof a === 'string' ? a : JSON.stringify(a)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <CategoryDistributionChart data={slices} total={total} title="Event Categories" />
        <EventTimelineChart points={timeline} title="Event Activity Over Time" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <InfoTile label="Start" value={formatDateTime(session.startTime)} />
        <InfoTile label="End" value={session.endTime ? formatDateTime(session.endTime) : 'N/A'} />
        <InfoTile label="Events Collected" value={session.eventsCollected ?? 0} />
      </div>

      {Array.isArray(session.evidenceFiles) && session.evidenceFiles.length > 0 && (
        <div className="p-3 bg-[var(--surface-container-lowest)]  rounded-lg">
          <p className="text-xs text-[var(--text-secondary)]  mb-1">Evidence Files</p>
          <div className="flex flex-wrap gap-1.5">
            {session.evidenceFiles.map((f: string, i: number) => (
              <span key={i} className="px-2 py-0.5 bg-[var(--surface-container-low)]  text-[var(--text-secondary)]  rounded text-xs font-mono">{f}</span>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(session.errorMessages) && session.errorMessages.length > 0 && (
        <div className="p-3 rounded-lg bg-red-50/50 border border-red-200/50">
          <p className="text-xs text-red-600 font-medium mb-1">Session Errors</p>
          {session.errorMessages.map((err: string, i: number) => (
            <p key={i} className="text-xs font-mono text-red-500">{err}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalysisDetail({ item }: { item: AnalysisReportItem }) {
  const isUrl = item.analysisType === 'url_analysis';
  const insights = item.aiInsights;
  const metadata = (item.metadata || {}) as Record<string, any>;
  const parsed = metadata.parsed as Record<string, any> | undefined;
  const domainIntel = metadata.domain_intel as Record<string, any> | undefined;
  const redirect = metadata.redirect_analysis as Record<string, any> | undefined;

  return (
    <div className="space-y-4">
      <div className="p-4 bg-[var(--surface-container-lowest)]  rounded-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            {isUrl ? <Globe className="w-6 h-6 text-blue-600 " /> : <FileSearch className="w-6 h-6 text-violet-600 " />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-[var(--text-primary)]  truncate">{item.sourceName}</p>
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-container-low)] text-[var(--text-secondary)] ">
                {isUrl ? 'URL' : String(item.sourceType || 'document').toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]  mt-0.5">{formatDateTime(item.analysisTimestamp)}</p>
          </div>
        </div>
        <div className="mt-3">
          <VerdictBanner
            threatType={item.threatLevel}
            confidence={item.confidence !== undefined ? Math.round(item.confidence * 100) : 0}
            riskScore={item.threatScore}
            artifactLabel={item.sourceName}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoTile label="Threat Score" value={item.threatScore ?? 'N/A'} />
        <InfoTile label="Confidence" value={item.confidence !== undefined ? `${Math.round(item.confidence * 100)}%` : 'N/A'} />
        <InfoTile label="IOCs" value={item.iocCount ?? item.indicators?.length ?? 0} />
        <InfoTile label="MITRE Techniques" value={item.mitreTechniques?.length ?? 0} />
      </div>

      {item.summary && (
        <div className="p-4 bg-[var(--surface-container-lowest)]  rounded-lg">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-1">Summary</p>
          <p className="text-sm text-[var(--text-secondary)] ">{item.summary}</p>
        </div>
      )}

      {Array.isArray(item.findings) && item.findings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Findings</p>
          {item.findings.map((f, i) => (
            <div key={i} className={cn('p-3 rounded-lg border', severityColors[f.severity || 'info'] || severityColors.info)}>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('px-2 py-0.5 rounded text-xs font-medium', severityColors[f.severity || 'info'])}>
                  {(f.severity || 'info').toUpperCase()}
                </span>
                <span className="text-sm font-medium text-[var(--text-primary)] ">{f.title || f.type}</span>
              </div>
              {f.description && <p className="text-sm text-[var(--text-secondary)] ">{f.description}</p>}
              {Array.isArray(f.evidence) && f.evidence.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {f.evidence.map((ev: string, j: number) => (
                    <span key={j} className="px-2 py-0.5 bg-[var(--surface-container-low)]  text-[var(--text-secondary)]  rounded text-xs font-mono">{ev}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {Array.isArray(item.indicators) && item.indicators.length > 0 && (
        <div className="p-4 bg-[var(--surface-container-lowest)]  rounded-lg">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">Extracted IOCs</p>
          <div className="flex flex-wrap gap-1.5">
            {item.indicators.map((ind, i) => (
              <span key={i} className="px-2 py-1 bg-[var(--surface-container-low)]  text-[var(--text-secondary)]  rounded text-xs font-mono">
                <span className="text-[var(--text-secondary)] uppercase text-[10px] mr-1">{ind.type}</span>
                {ind.value}
              </span>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(item.mitreTechniques) && item.mitreTechniques.length > 0 && (
        <div className="p-4 bg-[var(--surface-container-lowest)]  rounded-lg">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">MITRE ATT&CK Techniques</p>
          <div className="flex flex-wrap gap-1.5">
            {item.mitreTechniques.map((t: string, i: number) => (
              <span key={i} className="px-2 py-0.5 bg-violet-500/15 text-violet-600  rounded text-xs font-mono">{t}</span>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(item.heuristicsTriggered) && item.heuristicsTriggered.length > 0 && (
        <div className="p-4 bg-[var(--surface-container-lowest)]  rounded-lg">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">Heuristics Triggered</p>
          <div className="flex flex-wrap gap-1.5">
            {item.heuristicsTriggered.map((h: string, i: number) => (
              <span key={i} className="px-2 py-0.5 bg-orange-500/15 text-orange-600  rounded text-xs font-mono">{h}</span>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(item.recommendations) && item.recommendations.length > 0 && (
        <div className="p-4 bg-[var(--surface-container-lowest)]  rounded-lg">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-1">Recommendations</p>
          <ul className="text-sm text-[var(--text-secondary)]  list-disc list-inside space-y-1">
            {item.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {insights?.llm_available && (
        <div className="p-4 bg-[var(--surface-container-lowest)]  rounded-lg border border-violet-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-violet-600 " />
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">AI Insights</p>
            <span className="px-2 py-0.5 rounded text-[10px] bg-violet-500/15 text-violet-600  font-medium">
              {insights.provider || 'llm'} {insights.model ? `· ${insights.model}` : ''}
            </span>
          </div>
          {insights.executive_summary && (
            <p className="text-sm text-[var(--text-secondary)]  mb-2">{insights.executive_summary}</p>
          )}
          <div className="flex flex-wrap gap-3 text-xs">
            {insights.classification_opinion && (
              <span className="text-[var(--text-secondary)]">
                Opinion: <span className="font-medium text-[var(--text-primary)]  capitalize">{insights.classification_opinion}</span>
              </span>
            )}
            {insights.llm_confidence !== undefined && insights.llm_confidence !== null && (
              <span className="text-[var(--text-secondary)]">
                Confidence: <span className="font-medium text-[var(--text-primary)] ">{Math.round(insights.llm_confidence * 100)}%</span>
              </span>
            )}
          </div>
          {Array.isArray(insights.mitre_techniques) && insights.mitre_techniques.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {insights.mitre_techniques.map((t: string, i: number) => (
                <span key={i} className="px-2 py-0.5 bg-violet-500/15 text-violet-600  rounded text-[11px] font-mono">{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {(parsed || domainIntel || redirect) && (
        <div className="p-4 bg-[var(--surface-container-lowest)]  rounded-lg">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">URL Intelligence</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            {parsed?.protocol && <InfoTile label="Protocol" value={String(parsed.protocol).replace(':', '')} />}
            {parsed?.hostname && <InfoTile label="Hostname" value={String(parsed.hostname)} />}
            {parsed?.tld !== undefined && <InfoTile label="TLD" value={String(parsed.tld || 'n/a')} />}
            {parsed?.is_ip_based !== undefined && <InfoTile label="IP-based" value={parsed.is_ip_based ? 'Yes' : 'No'} />}
            {domainIntel?.age_days !== undefined && <InfoTile label="Domain Age" value={`${domainIntel.age_days} days`} />}
            {domainIntel?.registrar !== undefined && <InfoTile label="Registrar" value={String(domainIntel.registrar || 'n/a')} />}
            {domainIntel?.suspicious_tld !== undefined && <InfoTile label="Suspicious TLD" value={domainIntel.suspicious_tld ? 'Yes' : 'No'} />}
            {domainIntel?.known_malicious !== undefined && <InfoTile label="Known Malicious" value={domainIntel.known_malicious ? 'Yes' : 'No'} />}
            {metadata?.phishing_probability !== undefined && (
              <InfoTile label="Phishing Probability" value={`${Math.round(Number(metadata.phishing_probability) * 100)}%`} />
            )}
            {redirect?.chain_length !== undefined && (
              <InfoTile label="Redirect Chain" value={`${redirect.chain_length} hop(s)`} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExecutionReportDetail({
  currentReport,
  isDetailLoading,
  aiAnalysis,
  sessionData,
  detailTab,
  setDetailTab,
  onExport,
}: {
  currentReport: ForensicReportDetail | null;
  isDetailLoading: boolean;
  aiAnalysis: any;
  sessionData: any;
  detailTab: DetailTab;
  setDetailTab: (tab: DetailTab) => void;
  onExport: (id: string, format: 'json' | 'text' | 'pdf') => void;
}) {
  if (isDetailLoading || !currentReport) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        {isDetailLoading ? (
          <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
        ) : (
          <p className="text-sm text-[var(--text-secondary)] ">Failed to load report details</p>
        )}
      </div>
    );
  }

  const aiSeverity = aiAnalysis?.severity_level;
  const threatLabel = aiSeverity
    ? aiSeverity === 'critical' ? 'CRITICAL RISK'
      : aiSeverity === 'high' ? 'HIGH RISK'
      : aiSeverity === 'medium' ? 'MEDIUM RISK'
      : aiSeverity === 'low' ? 'LOW RISK'
      : aiSeverity
    : 'N/A — pending analysis';
  const classification = aiAnalysis?.threat_classification && Object.keys(aiAnalysis.threat_classification).length > 0
    ? Object.keys(aiAnalysis.threat_classification).slice(0, 2).map((k) => k.replace(/_/g, ' ').toUpperCase()).join(' / ')
    : 'N/A — pending analysis';
  const confidenceLabel = aiAnalysis?.confidence !== undefined ? `${Math.round(aiAnalysis.confidence * 100)}%` : 'N/A — pending analysis';
  const eventCategories = ['process', 'file', 'registry', 'network', 'behavior', 'system'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 bg-[var(--surface-container-lowest)]  rounded-lg">
        <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
          <FileText className="w-6 h-6 text-amber-600 " />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--text-primary)] ">{currentReport.simulatorName}</p>
          <p className="text-xs text-[var(--text-secondary)]   font-mono">{currentReport.reportFile}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={() => onExport(currentReport.id, 'pdf')}>PDF</Button>
          <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={() => onExport(currentReport.id, 'json')}>JSON</Button>
          <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={() => onExport(currentReport.id, 'text')}>TXT</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {Object.entries(currentReport.severityCounts || {}).map(([level, count]) => (
          <div key={level} className={cn('p-3 rounded-lg', severityColors[level] || severityColors.info)}>
            <p className="text-xs font-medium uppercase">{level}</p>
            <p className="text-2xl font-bold mt-1">{count}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-[var(--border-subtle)]  overflow-x-auto">
        {(['case-report', 'timeline', 'events', 'suspicious', 'summary', 'ai-analysis', 'sandbox-findings'] as DetailTab[]).map((tab) => (
          <button key={tab} onClick={() => setDetailTab(tab)}
            className={cn('px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors whitespace-nowrap',
              detailTab === tab
                ? 'border-amber-500 text-amber-600 '
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-secondary)] '
            )}>
            {tab}
          </button>
        ))}
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {detailTab === 'timeline' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <Clock className="w-4 h-4 text-[var(--text-secondary)] " />
              <span className="text-[var(--text-secondary)] ">Start: {formatDateTime(currentReport.executionSummary?.startTime || currentReport.generatedAt)}</span>
              <span className="text-[var(--text-secondary)] ">→</span>
              <span className="text-[var(--text-secondary)] ">End: {formatDateTime(currentReport.executionSummary?.endTime || currentReport.generatedAt)}</span>
              <span className="text-[var(--text-secondary)] ">•</span>
              <span className="text-[var(--text-secondary)] ">Duration: {formatDuration(currentReport.executionTime)}</span>
            </div>
            <div className="text-sm">
              <span className="text-[var(--text-secondary)] ">Status: </span>
              <span className={cn('font-medium',
                currentReport.executionSummary?.completionStatus === 'completed' ? 'text-emerald-600' :
                currentReport.executionSummary?.completionStatus === 'failed' ? 'text-red-600' :
                'text-amber-600'
              )}>
                {currentReport.executionSummary?.completionStatus || 'completed'}
              </span>
            </div>
          </div>
        )}

        {detailTab === 'events' && (
          <div className="space-y-2">
            {eventCategories.map((cat) => {
              const events = currentReport[`${cat}Activity` as keyof typeof currentReport] as unknown[] || [];
              if (events.length === 0) return null;
              return (
                <div key={cat}>
                  <p className="text-xs font-semibold text-[var(--text-secondary)]   uppercase mb-2">{cat} ({events.length})</p>
                  {events.slice(0, 5).map((evt: unknown) => {
                    const e = evt as { operation?: string; timestamp?: string; severity?: string };
                    return (
                      <div key={(e.timestamp || '') + (e.operation || '')} className="p-2 bg-[var(--surface-container-lowest)]  rounded text-xs mb-1">
                        <span className="text-[var(--text-secondary)]  font-mono">{e.timestamp}</span>
                        <span className="mx-2 text-[var(--text-secondary)] ">|</span>
                        <span className="text-[var(--text-secondary)] ">{e.operation}</span>
                        {e.severity && <span className={cn('ml-2 px-1.5 py-0.5 rounded text-xs font-medium', severityColors[e.severity])}>{e.severity}</span>}
                      </div>
                    );
                  })}
                  {events.length > 5 && <p className="text-xs text-[var(--text-secondary)] ">+{events.length - 5} more events</p>}
                </div>
              );
            })}
          </div>
        )}

        {detailTab === 'suspicious' && (
          <div className="space-y-2">
            {currentReport.suspiciousActivities?.length === 0 && (
              <p className="text-sm text-[var(--text-secondary)]  text-center py-4">No suspicious activities detected</p>
            )}
            {currentReport.suspiciousActivities?.map((act, i) => (
              <div key={i} className={cn('p-3 rounded-lg border', severityColors[act.severity] || severityColors.info)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-[var(--text-secondary)]">{act.timestamp}</span>
                  <span className={cn('px-2 py-0.5 rounded text-xs font-medium', severityColors[act.severity])}>{act.severity}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] ">{act.description}</p>
                {act.indicators?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {act.indicators.map((ind, j) => (
                      <span key={j} className="px-2 py-0.5 bg-[var(--surface-container-low)]  text-[var(--text-secondary)]  rounded text-xs">{ind.type}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {detailTab === 'case-report' && (
          <div className="rounded-lg border border-dashed border-[var(--border-default)]  p-4 font-mono text-[13px] space-y-2">
            <p className="text-center font-semibold tracking-[0.08em] text-[var(--text-primary)] ">CYBER FORENSIC DASHBOARD</p>
            <p className="text-center text-[var(--text-secondary)]   text-[11px]">━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
            <CaseRow label="Case ID" value={currentReport.sessionId ? `CASE-${currentReport.sessionId.slice(0, 8).toUpperCase()}` : 'N/A — pending analysis'} />
            <CaseRow label="Evidence" value={sessionData?.evidenceFiles?.[0] || 'N/A — pending analysis'} />
            <CaseRow label="Threat" value={threatLabel} />
            <CaseRow label="Classification" value={classification} />
            <CaseRow label="AI Confidence" value={confidenceLabel} />
            <CaseRow label="SHA-256" value={currentReport.hash?.sha256 ? currentReport.hash.sha256.slice(0, 8) + '............' : 'N/A — pending analysis'} />
            <CaseRow label="Blockchain" value={currentReport.blockchainVerified ? '✓ VERIFIED' : 'N/A — pending analysis'} />
            <CaseRow label="Evidence Status" value={currentReport.collectionIntegrity?.verified ? '✓ INTEGRITY CONFIRMED' : 'N/A — pending analysis'} />
            <p className="text-center text-[var(--text-secondary)]   text-[11px] pt-1">━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
          </div>
        )}

        {detailTab === 'ai-analysis' && (
          <div className="space-y-3">
            {aiAnalysis ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <InfoTile label="Severity Level" value={aiSeverity ? String(aiSeverity).toUpperCase() : 'N/A'} />
                  <InfoTile label="Confidence" value={aiAnalysis.confidence !== undefined ? `${Math.round(aiAnalysis.confidence * 100)}%` : 'N/A'} />
                  <InfoTile label="Total Events" value={aiAnalysis.total_events ?? 'N/A'} />
                  <InfoTile label="Suspicious Events" value={aiAnalysis.suspicious_events ?? 'N/A'} />
                </div>
                {aiAnalysis.threat_classification && Object.keys(aiAnalysis.threat_classification).length > 0 && (
                  <div className="p-3 bg-[var(--surface-container-lowest)]  rounded-lg">
                    <p className="text-xs text-[var(--text-secondary)]  mb-1">Threat Classification</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(aiAnalysis.threat_classification).map(([k, v]) => (
                        <span key={k} className="px-2 py-0.5 bg-amber-500/15 text-amber-600   rounded text-xs font-medium">
                          {k.replace(/_/g, ' ')} · {typeof v === 'number' ? `${Math.round(v * 100)}%` : String(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {aiAnalysis.behavioral_summary && (
                  <div className="p-3 bg-[var(--surface-container-lowest)]  rounded-lg">
                    <p className="text-xs text-[var(--text-secondary)]  mb-1">Behavioral Summary</p>
                    <p className="text-sm text-[var(--text-secondary)] ">{aiAnalysis.behavioral_summary}</p>
                  </div>
                )}
                {Array.isArray(aiAnalysis.recommendations) && aiAnalysis.recommendations.length > 0 && (
                  <div className="p-3 bg-[var(--surface-container-lowest)]  rounded-lg">
                    <p className="text-xs text-[var(--text-secondary)]  mb-1">Recommendations</p>
                    <ul className="text-sm text-[var(--text-secondary)]  list-disc list-inside space-y-1">
                      {aiAnalysis.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
                {Array.isArray(aiAnalysis.anomalies) && aiAnalysis.anomalies.length > 0 && (
                  <div className="p-3 bg-[var(--surface-container-lowest)]  rounded-lg">
                    <p className="text-xs text-[var(--text-secondary)]  mb-1">Detected Anomalies</p>
                    <ul className="text-sm text-[var(--text-secondary)]  list-disc list-inside space-y-1">
                      {aiAnalysis.anomalies.map((a: unknown, i: number) => <li key={i}>{typeof a === 'string' ? a : JSON.stringify(a)}</li>)}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]  text-center py-6">N/A — pending analysis</p>
            )}
          </div>
        )}

        {detailTab === 'sandbox-findings' && (
          <div className="space-y-3">
            {sessionData ? (
              <div className="grid grid-cols-2 gap-3">
                <InfoTile label="Session Status" value={sessionData.status || sessionData.state || 'N/A'} />
                <InfoTile label="Events Collected" value={sessionData.eventsCollected ?? sessionData.totalEvents ?? 'N/A'} />
                <InfoTile label="Suspicious Events" value={Array.isArray(sessionData.suspiciousEvents) ? sessionData.suspiciousEvents.length : (sessionData.suspiciousEvents ?? 'N/A')} />
                <InfoTile label="Evidence Files" value={Array.isArray(sessionData.evidenceFiles) ? sessionData.evidenceFiles.length : 'N/A'} />
                {Array.isArray(sessionData.evidenceFiles) && sessionData.evidenceFiles.length > 0 && (
                  <div className="col-span-2 p-3 bg-[var(--surface-container-lowest)]  rounded-lg">
                    <p className="text-xs text-[var(--text-secondary)]  mb-1">Collected Evidence</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sessionData.evidenceFiles.map((f: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-[var(--surface-container-low)]  text-[var(--text-secondary)]  rounded text-xs font-mono">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]  text-center py-6">N/A — pending analysis</p>
            )}
          </div>
        )}

        {detailTab === 'summary' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[var(--surface-container-lowest)]  rounded-lg">
                <p className="text-xs text-[var(--text-secondary)] ">Risk Score</p>
                <p className="text-2xl font-bold text-[var(--text-primary)] ">{currentReport.behaviorSummary?.overallRiskScore ?? 'N/A'}</p>
              </div>
              <div className="p-3 bg-[var(--surface-container-lowest)]  rounded-lg">
                <p className="text-xs text-[var(--text-secondary)] ">Events Collected</p>
                <p className="text-2xl font-bold text-[var(--text-primary)] ">{currentReport.executionSummary?.eventsCollected ?? currentReport.totalEvents}</p>
              </div>
            </div>
            {currentReport.collectionIntegrity && (
              <div className="p-3 bg-[var(--surface-container-lowest)]  rounded-lg">
                <p className="text-xs text-[var(--text-secondary)]  mb-1">Collection Integrity</p>
                <p className="text-xs font-mono text-[var(--text-secondary)] ">{currentReport.collectionIntegrity.hashAlgorithm}: {currentReport.collectionIntegrity.hash}</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs text-[var(--text-secondary)]">{currentReport.collectionIntegrity.fileCount} files</span>
                  <span className="text-xs text-[var(--text-secondary)]">{formatFileSize(currentReport.collectionIntegrity.totalSize)}</span>
                  <span className={cn('text-xs font-medium', currentReport.collectionIntegrity.verified ? 'text-emerald-600' : 'text-[var(--text-secondary)] ')}>
                    {currentReport.collectionIntegrity.verified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
              </div>
            )}
            {currentReport.hash && (
              <div className="p-3 bg-[var(--surface-container-lowest)]  rounded-lg">
                <p className="text-xs text-[var(--text-secondary)]  mb-1">File Hashes</p>
                {currentReport.hash.sha256 && <p className="text-xs font-mono text-[var(--text-secondary)] ">SHA256: {currentReport.hash.sha256}</p>}
                {currentReport.hash.md5 && <p className="text-xs font-mono text-[var(--text-secondary)] ">MD5: {currentReport.hash.md5}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ReportsPage() {
  const {
    reports, currentReport, isLoading, isDetailLoading, error,
    pagination, filters,
    sessions, sessionsPagination, isSessionsLoading,
    analysisDocs, analysisUrls, analysisPagination, isAnalysisLoading,
    fetchReports, fetchReportById, exportReport, setFilters, clearCurrentReport,
    fetchSessions, fetchAnalysisHistory, clearCurrentAnalysis,
  } = useReportsStore();

  const [tab, setTab] = useState<SourceTab>('sessions');
  const [search, setSearch] = useState('');
  const [detailTab, setDetailTab] = useState<DetailTab>('case-report');
  const [view, setView] = useState<ViewState>(null);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [analysisPage, setAnalysisPage] = useState(1);
  const [executionPage, setExecutionPage] = useState(1);

  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    fetchReports();
    fetchSessions(1, 20);
    fetchAnalysisHistory('document_analysis', 1, 20);
    fetchAnalysisHistory('url_analysis', 1, 20);
  }, []);

  const reportAiMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const s of sessions) {
      if (s.aiAnalysis) map[s.sessionId] = s.aiAnalysis;
    }
    return map;
  }, [sessions]);

  useEffect(() => {
    if (view?.kind !== 'execution') return;
    const sessionId = reports.find((r) => r.id === view.id)?.sessionId;
    if (!sessionId) return;
    let cancelled = false;
    const loadData = async () => {
      try {
        const [aiResp, sessResp] = await Promise.all([
          api.getSessionAIAnalysis(sessionId),
          api.getSandboxSession(sessionId),
        ]);
        if (cancelled) return;
        setAiAnalysis(aiResp.success && aiResp.data?.aiAnalysis ? aiResp.data.aiAnalysis : null);
        setSessionData(sessResp.success && sessResp.data ? sessResp.data : null);
      } catch {
        if (!cancelled) {
          setAiAnalysis(null);
          setSessionData(null);
        }
      }
    };
    loadData();
    return () => {
      cancelled = true;
    };
  }, [view, reports]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filters.search) {
        setFilters({ search });
        if (tab === 'execution') {
          setExecutionPage(1);
          fetchReports({ search, page: 1 });
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleViewReport = async (id: string) => {
    await fetchReportById(id);
    setDetailTab('case-report');
    setView({ kind: 'execution', id });
  };

  const handleViewSandbox = (session: SandboxSessionWithExtras) => {
    setView({ kind: 'sandbox', session });
  };

  const handleViewAnalysis = (item: AnalysisReportItem) => {
    setView({ kind: 'analysis', item });
  };

  const handleCloseDetail = () => {
    setView(null);
    setAiAnalysis(null);
    setSessionData(null);
    clearCurrentReport();
    clearCurrentAnalysis();
  };

  const switchTab = (next: SourceTab) => {
    setTab(next);
    if (next === 'sessions' && sessions.length === 0) fetchSessions(1, 20);
    if (next === 'documents' && analysisDocs.length === 0) fetchAnalysisHistory('document_analysis', 1, 20);
    if (next === 'urls' && analysisUrls.length === 0) fetchAnalysisHistory('url_analysis', 1, 20);
    if (next === 'execution' && reports.length === 0) fetchReports();
  };

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) =>
      String(s.simulatorName || '').toLowerCase().includes(q) ||
      String(s.sessionId || '').toLowerCase().includes(q) ||
      String(s.status || '').toLowerCase().includes(q)
    );
  }, [sessions, search]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return analysisDocs;
    return analysisDocs.filter((d) =>
      String(d.sourceName || '').toLowerCase().includes(q) ||
      String(d.threatLevel || '').toLowerCase().includes(q) ||
      String(d.predictedThreat || '').toLowerCase().includes(q)
    );
  }, [analysisDocs, search]);

  const filteredUrls = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return analysisUrls;
    return analysisUrls.filter((u) =>
      String(u.sourceName || '').toLowerCase().includes(q) ||
      String(u.threatLevel || '').toLowerCase().includes(q) ||
      String(u.predictedThreat || '').toLowerCase().includes(q)
    );
  }, [analysisUrls, search]);

  const modalTitle = view?.kind === 'execution' ? 'Execution Report' : view?.kind === 'sandbox' ? 'Sandbox Session Analytics' : view?.kind === 'analysis' ? (view.item.analysisType === 'url_analysis' ? 'URL Analysis' : 'Document Analysis') : 'Report Details';

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <PageHeader
        title="Forensic Reports"
        subtitle="Detailed analytics and graphs of AI analysis across sandbox sessions, documents and URLs"
        eyebrow="Reports · Case Dossier"
        stamp="EXHIBIT A"
      />

      <PageGrid columns={4}>
        <DashboardCard>
          <DashboardStat
            label="Sandbox Sessions"
            value={sessionsPagination.total || sessions.length}
            icon={<Terminal className="w-5 h-5 text-violet-600 " />}
            mono
            stamp="STAGED"
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Document Analyses"
            value={analysisDocs.length}
            icon={<FileSearch className="w-5 h-5 text-violet-600  " />}
            mono
            stamp="PARSED"
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="URL Analyses"
            value={analysisUrls.length}
            icon={<Globe className="w-5 h-5 text-blue-600  " />}
            mono
            stamp="SCANNED"
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Execution Reports"
            value={pagination.total || reports.length}
            icon={<FileText className="w-5 h-5 text-amber-600  " />}
            mono
            stamp="DOCKETED"
          />
        </DashboardCard>
      </PageGrid>

      <div className="flex gap-2 border-b border-[var(--border-subtle)]  overflow-x-auto">
        {([
          { key: 'sessions', label: 'Sandbox Sessions', icon: Terminal },
          { key: 'documents', label: 'Documents', icon: FileSearch },
          { key: 'urls', label: 'URLs', icon: Globe },
          { key: 'execution', label: 'Execution Reports', icon: FileText },
        ] as Array<{ key: SourceTab; label: string; icon: typeof Terminal }>).map((t) => (
          <button key={t.key} onClick={() => switchTab(t.key)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap',
              tab === t.key
                ? 'border-amber-500 text-amber-600 '
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-secondary)] '
            )}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder={tab === 'execution' ? 'Search reports...' : `Search ${tab === 'sessions' ? 'sessions' : tab === 'documents' ? 'documents' : 'URLs'}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          {tab === 'execution' && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[var(--text-secondary)] " />
              <Select
                value={filters.simulator}
                onChange={(val) => { setFilters({ simulator: val }); fetchReports({ simulator: val }); }}
                options={[
                  { value: '', label: 'All Simulators' },
                  { value: 'ransomware', label: 'Ransomware' },
                  { value: 'spyware', label: 'Spyware' },
                  { value: 'trojan', label: 'Trojan' },
                  { value: 'botnet', label: 'Botnet' },
                  { value: 'credential-stealer', label: 'Credential Stealer' },
                ]}
              />
              <Select
                value={filters.severity}
                onChange={(val) => { setFilters({ severity: val }); fetchReports({ severity: val }); }}
                options={[
                  { value: '', label: 'All Severity' },
                  { value: 'critical', label: 'Critical' },
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                  { value: 'info', label: 'Info' },
                ]}
              />
            </div>
          )}
        </div>

        {/* Sandbox sessions tab */}
        {tab === 'sessions' && (
          <>
            {isSessionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Terminal className="w-12 h-12 text-[var(--text-secondary)]   mb-3" />
                <p className="text-sm text-[var(--text-secondary)] ">{search ? 'No sessions match your search.' : 'No sandbox sessions yet. Start a simulation from the Sandbox page.'}</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] ">
                {filteredSessions.map((session) => {
                  const ai = session.aiAnalysis;
                  return (
                    <motion.div
                      key={session.sessionId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => handleViewSandbox(session)}
                      className="px-5 py-4 hover:bg-[var(--surface-container-lowest)]  cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
                          <Terminal className="w-5 h-5 text-violet-600 " />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-[var(--text-primary)]  truncate">{session.simulatorName}</p>
                            {ai?.severity_level ? (
                              <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium', severityColors[ai.severity_level] || severityColors.info)}>
                                <Brain className="w-3 h-3 mr-1" /> AI · {String(ai.severity_level).toUpperCase()}
                                {ai.confidence !== undefined && ` · ${Math.round(ai.confidence * 100)}%`}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-600">
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" /> AI pending
                              </span>
                            )}
                            <span className={cn('px-2 py-0.5 rounded text-[11px] font-medium',
                              session.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                              session.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600')}>
                              {String(session.status || 'unknown').toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-[var(--text-secondary)]   font-mono">{session.sessionId}</span>
                            <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                            <span className="text-xs text-[var(--text-secondary)]  ">{formatDateTime(session.startTime)}</span>
                            <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                            <span className="text-xs text-[var(--text-secondary)]  ">{session.eventsCollected ?? 0} events</span>
                            {ai?.total_events !== undefined && (
                              <>
                                <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                                <span className="text-xs text-[var(--text-secondary)]  ">{ai.suspicious_events ?? 0} suspicious</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {ai?.threat_classification && Object.keys(ai.threat_classification).length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-[var(--surface-container-low)] text-[var(--text-secondary)]">
                              <Activity className="w-3 h-3" />
                              {Object.entries(ai.threat_classification).sort((a, b) => Number(b[1]) - Number(a[1]))[0][0].replace(/_/g, ' ')}
                            </span>
                          )}
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewSandbox(session); }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Documents / URLs tabs */}
        {(tab === 'documents' || tab === 'urls') && (
          <>
            {isAnalysisLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
              </div>
            ) : (tab === 'documents' ? filteredDocs : filteredUrls).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                {tab === 'documents' ? <FileSearch className="w-12 h-12 text-[var(--text-secondary)]   mb-3" /> : <Globe className="w-12 h-12 text-[var(--text-secondary)]   mb-3" />}
                <p className="text-sm text-[var(--text-secondary)] ">
                  {search
                    ? 'No results match your search.'
                    : tab === 'documents'
                      ? 'No document analyses found. Upload a document from the AI Analysis page.'
                      : 'No URL analyses found. Submit a URL from the AI Analysis page.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] ">
                {(tab === 'documents' ? filteredDocs : filteredUrls).map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => handleViewAnalysis(item)}
                    className="px-5 py-4 hover:bg-[var(--surface-container-lowest)]  cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                        {tab === 'documents' ? <FileSearch className="w-5 h-5 text-violet-600 " /> : <Globe className="w-5 h-5 text-blue-600 " />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-[var(--text-primary)]  truncate">{item.sourceName}</p>
                          {item.threatLevel && (
                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium', severityColors[item.threatLevel] || severityColors.info)}>
                              {String(item.threatLevel).toUpperCase()}
                              {item.confidence !== undefined && ` · ${Math.round(item.confidence * 100)}%`}
                            </span>
                          )}
                          {item.analyzedBy === 'system' && item.aiInsights?.llm_available && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-violet-100 text-violet-600">
                              <Brain className="w-3 h-3 mr-1" /> AI
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-[var(--text-secondary)]  ">{formatDateTime(item.analysisTimestamp)}</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">Score: {item.threatScore ?? 0}</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">{item.iocCount ?? item.indicators?.length ?? 0} IOCs</span>
                          {Array.isArray(item.mitreTechniques) && item.mitreTechniques.length > 0 && (
                            <>
                              <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                              <span className="text-xs text-[var(--text-secondary)]  font-mono">{item.mitreTechniques.length} MITRE</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewAnalysis(item); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Execution reports tab */}
        {tab === 'execution' && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-red-500 mb-3">{error}</p>
                <Button variant="outline" size="sm" onClick={() => fetchReports()}>Retry</Button>
              </div>
            ) : reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-[var(--text-secondary)]   mb-3" />
                <p className="text-sm text-[var(--text-secondary)] ">No reports found. Run a simulation to generate reports.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] ">
                {reports.map((report, index) => (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleViewReport(report.id)}
                    className="px-5 py-4 hover:bg-[var(--surface-container-lowest)]  cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-amber-600 " />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[var(--text-primary)]  truncate">{report.simulatorName}</p>
                          {report.blockchainVerified && <Shield className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                          {reportAiMap[report.sessionId]?.severity_level && (
                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium', severityColors[reportAiMap[report.sessionId].severity_level] || severityColors.info)}>
                              AI · {String(reportAiMap[report.sessionId].severity_level).toUpperCase()}
                              {reportAiMap[report.sessionId].confidence !== undefined && ` · ${Math.round(reportAiMap[report.sessionId].confidence * 100)}%`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-[var(--text-secondary)]   font-mono">{report.reportFile}</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">{formatDateTime(report.generatedAt)}</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">{report.totalEvents} events</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">{formatDuration(report.executionTime)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {['process', 'file', 'registry', 'network', 'behavior', 'system'].map((cat) => {
                          const count = report.categoryCounts?.[cat as keyof typeof report.categoryCounts] || 0;
                          if (count === 0) return null;
                          const Icon = categoryIcons[cat] || Activity;
                          return (
                            <span key={cat} className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs', categoryColors[cat])}>
                              <Icon className="w-3 h-3" />
                              {count}
                            </span>
                          );
                        })}
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewReport(report.id); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {tab === 'sessions' && sessionsPagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={sessionsPage <= 1} onClick={() => { setSessionsPage(sessionsPage - 1); fetchSessions(sessionsPage - 1, 20); }}>Previous</Button>
          <span className="text-sm text-[var(--text-secondary)]">Page {sessionsPage} of {sessionsPagination.totalPages}</span>
          <Button variant="outline" size="sm" disabled={sessionsPage >= sessionsPagination.totalPages} onClick={() => { setSessionsPage(sessionsPage + 1); fetchSessions(sessionsPage + 1, 20); }}>Next</Button>
        </div>
      )}

      {(tab === 'documents' || tab === 'urls') && analysisPagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={analysisPage <= 1} onClick={() => { setAnalysisPage(analysisPage - 1); fetchAnalysisHistory(tab === 'documents' ? 'document_analysis' : 'url_analysis', analysisPage - 1, 20); }}>Previous</Button>
          <span className="text-sm text-[var(--text-secondary)]">Page {analysisPage} of {analysisPagination.totalPages}</span>
          <Button variant="outline" size="sm" disabled={analysisPage >= analysisPagination.totalPages} onClick={() => { setAnalysisPage(analysisPage + 1); fetchAnalysisHistory(tab === 'documents' ? 'document_analysis' : 'url_analysis', analysisPage + 1, 20); }}>Next</Button>
        </div>
      )}

      {tab === 'execution' && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={executionPage <= 1} onClick={() => { setExecutionPage(executionPage - 1); fetchReports({ page: executionPage - 1 }); }}>Previous</Button>
          <span className="text-sm text-[var(--text-secondary)]">Page {executionPage} of {pagination.totalPages}</span>
          <Button variant="outline" size="sm" disabled={executionPage >= pagination.totalPages} onClick={() => { setExecutionPage(executionPage + 1); fetchReports({ page: executionPage + 1 }); }}>Next</Button>
        </div>
      )}

      <Modal isOpen={view !== null} onClose={handleCloseDetail} title={modalTitle} size="xl">
        {view?.kind === 'execution' && (
          <ExecutionReportDetail
            currentReport={currentReport}
            isDetailLoading={isDetailLoading}
            aiAnalysis={aiAnalysis}
            sessionData={sessionData}
            detailTab={detailTab}
            setDetailTab={setDetailTab}
            onExport={exportReport}
          />
        )}
        {view?.kind === 'sandbox' && <SandboxDetail session={view.session} onClose={handleCloseDetail} />}
        {view?.kind === 'analysis' && <AnalysisDetail item={view.item} />}
      </Modal>
    </motion.div>
  );
}

export default ReportsPage;
