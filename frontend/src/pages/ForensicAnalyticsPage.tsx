/**
 * Forensic Analytics Page
 * Overall analytics of platform activity: sandbox sessions, AI analyses,
 * telemetry volume, extracted IOCs, evidence, alerts + MITRE ATT&CK coverage.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Boxes, Activity, BrainCircuit, ShieldAlert, AlertOctagon,
  Fingerprint, FileCheck2, BellRing, Clock,
} from 'lucide-react';
import api from '../services/api';
import { CategoryDistributionChart, EventTimelineChart } from '../components/visualizations';

const MITRE_TACTICS = [
  { id: 'initial_access', name: 'Initial Access' },
  { id: 'execution', name: 'Execution' },
  { id: 'persistence', name: 'Persistence' },
  { id: 'privilege_escalation', name: 'Priv Escalation' },
  { id: 'defense_evasion', name: 'Defense Evasion' },
  { id: 'credential_access', name: 'Credential Access' },
  { id: 'discovery', name: 'Discovery' },
  { id: 'lateral_movement', name: 'Lateral Movement' },
  { id: 'collection', name: 'Collection' },
  { id: 'exfiltration', name: 'Exfiltration' },
  { id: 'impact', name: 'Impact' },
] as const;

const MITRE_TECHNIQUES: Record<string, Array<{ id: string; name: string }>> = {
  initial_access: [{ id: 'T1566', name: 'Phishing' }, { id: 'T1190', name: 'Exploit Public App' }],
  execution: [{ id: 'T1059.001', name: 'PowerShell' }, { id: 'T1059.003', name: 'Cmd Shell' }, { id: 'T1204', name: 'User Execution' }],
  persistence: [{ id: 'T1547.001', name: 'Registry Run Keys' }, { id: 'T1053.005', name: 'Scheduled Task' }, { id: 'T1543', name: 'Create Service' }],
  privilege_escalation: [{ id: 'T1548', name: 'Abuse Elevation' }, { id: 'T1134', name: 'Token Manipulation' }],
  defense_evasion: [{ id: 'T1055', name: 'Process Injection' }, { id: 'T1027', name: 'Obfuscation' }, { id: 'T1070.004', name: 'File Deletion' }, { id: 'T1497', name: 'Sandbox Evasion' }],
  credential_access: [{ id: 'T1003', name: 'OS Credential Dump' }, { id: 'T1110', name: 'Brute Force' }],
  discovery: [{ id: 'T1082', name: 'System Info' }, { id: 'T1083', name: 'File Discovery' }, { id: 'T1057', name: 'Process Discovery' }, { id: 'T1012', name: 'Query Registry' }],
  lateral_movement: [{ id: 'T1021.002', name: 'SMB Shares' }, { id: 'T1105', name: 'Tool Transfer' }],
  collection: [{ id: 'T1560', name: 'Archive Data' }, { id: 'T1005', name: 'Local Data' }],
  exfiltration: [{ id: 'T1048', name: 'Alt Protocol' }, { id: 'T1041', name: 'C2 Channel' }],
  impact: [{ id: 'T1486', name: 'Data Encrypted' }, { id: 'T1490', name: 'Inhibit Recovery' }],
};

interface DetectedTechnique {
  technique_id: string;
  technique_name: string;
  tactic: string;
  confidence: number;
  evidence_snippets: string[];
}

interface DashboardData {
  summary: { totalClusters: number; highSeverityInsights: number; totalPatterns: number; criticalPatterns: number };
  patterns: Array<{ patternId: string; category: string; name: string; description: string; severity: string; mitreTactics: string[] }>;
  insights: Array<{ insightId: string; type: string; title: string; description: string; severity: string; confidence: number }>;
  clusters: Array<{ clusterId: string; label: string; investigationIds: string[]; strength: number }>;
}

interface AnalysisItem {
  analysisId: string;
  analysisType: string;
  sourceType: string;
  sourceName: string;
  threatScore: number;
  threatLevel: string;
  confidence: number;
  analysisTimestamp?: string;
}

interface SandboxSession {
  sessionId: string;
  simulatorName?: string;
  status: string;
  startTime?: string;
  eventsCollected?: number;
  aiAnalysis?: {
    severity_level?: string;
    severity_score?: number;
    total_events?: number;
    suspicious_events?: number;
  };
}

const SEVERITY_LIGHT: Record<string, { text: string; bg: string; dot: string }> = {
  critical: { text: 'text-red-700', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
  high: { text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  medium: { text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  low: { text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  info: { text: 'text-sky-700', bg: 'bg-sky-50 border-sky-200', dot: 'bg-sky-500' },
};

const dayKey = (ts?: string): string => {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dayLabel = (key: string): string => {
  const [, m, d] = key.split('-');
  return `${Number(m)}/${Number(d)}`;
};

export const ForensicAnalyticsPage = () => {
  const [detectedTechniques, setDetectedTechniques] = useState<DetectedTechnique[]>([]);
  const [expandedTechnique, setExpandedTechnique] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [sessions, setSessions] = useState<SandboxSession[]>([]);
  const [iocTotal, setIocTotal] = useState<number>(0);
  const [evidenceTotal, setEvidenceTotal] = useState<number>(0);
  const [alertsTotal, setAlertsTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, historyRes, sessionsRes, iocRes, evidenceRes, alertsRes] = await Promise.all([
        api.get<DashboardData>('/analytics/dashboard'),
        api.get<AnalysisItem[] | { items?: AnalysisItem[] }>('/analysis/history?limit=100'),
        api.get<SandboxSession[]>('/sandbox/sessions?limit=100'),
        api.get<{ stats?: { total?: number } }>('/threat/stats'),
        api.get<{ meta?: { total?: number } }>('/evidence'),
        api.get<{ meta?: { total?: number } }>('/alerts'),
      ]);

      if (analyticsRes.success && analyticsRes.data) setDashboardData(analyticsRes.data);

      const historyPayload = historyRes.success ? historyRes.data : null;
      setAnalyses(Array.isArray(historyPayload) ? historyPayload : historyPayload?.items || []);

      if (sessionsRes.success && Array.isArray(sessionsRes.data)) setSessions(sessionsRes.data);

      setIocTotal(iocRes.success ? iocRes.data?.stats?.total ?? 0 : 0);
      setEvidenceTotal(evidenceRes.success ? evidenceRes.data?.meta?.total ?? 0 : 0);
      setAlertsTotal(alertsRes.success ? alertsRes.data?.meta?.total ?? 0 : 0);
    } catch { /* empty state */ }
    setLoading(false);
  };

  useEffect(() => {
    if (!dashboardData || !dashboardData.patterns) return;
    const detected: DetectedTechnique[] = [];
    dashboardData.patterns.forEach((pattern) => {
      pattern.mitreTactics?.forEach((tactic) => {
        const techniques = MITRE_TECHNIQUES[tactic];
        if (techniques && techniques.length > 0) {
          detected.push({
            technique_id: techniques[0].id,
            technique_name: techniques[0].name,
            tactic,
            confidence: 0.85,
            evidence_snippets: [pattern.name],
          });
        }
      });
    });
    if (detected.length > 0) setDetectedTechniques(detected);
  }, [dashboardData]);

  const isDetected = (techniqueId: string): DetectedTechnique | undefined => {
    return detectedTechniques.find(t => t.technique_id === techniqueId);
  };

  const getCellGlow = (techniqueId: string): string => {
    const hit = isDetected(techniqueId);
    if (!hit) return '';
    if (hit.confidence >= 0.8) return 'ring-2 ring-red-400/60 shadow-[0_0_15px_rgba(239,68,68,0.2)]';
    if (hit.confidence >= 0.5) return 'ring-2 ring-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.2)]';
    return 'ring-1 ring-amber-400/40 shadow-[0_0_8px_rgba(245,158,11,0.12)]';
  };

  // --- Derived analytics ---
  const totalTelemetry = sessions.reduce((sum, s) => sum + (s.eventsCollected ?? s.aiAnalysis?.total_events ?? 0), 0);
  const suspiciousEvents = sessions.reduce((sum, s) => sum + (s.aiAnalysis?.suspicious_events ?? 0), 0);
  const highRiskSessions = sessions.filter(s => (s.aiAnalysis?.severity_level === 'high' || s.aiAnalysis?.severity_level === 'critical')).length;
  const avgSessionScore = sessions.length
    ? Math.round(sessions.reduce((sum, s) => sum + (s.aiAnalysis?.severity_score ?? 0), 0) / sessions.length)
    : 0;

  const verdictCounts: Array<{ key: string; count: number }> = (['critical', 'high', 'medium', 'low', 'info', 'unknown'] as const).map((key) => ({
    key,
    count: analyses.filter(a => (a.threatLevel || 'unknown').toLowerCase() === key).length,
  }));
  const maxVerdict = Math.max(1, ...verdictCounts.map(v => v.count));

  const typeDistribution = analyses.reduce<Record<string, number>>((acc, a) => {
    const t = a.analysisType?.replace('_analysis', '').replace('_', ' ') || 'other';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const typeSlices = Object.entries(typeDistribution).map(([category, count]) => ({ category, count, color: '' }));

  const timelinePoints = (() => {
    const buckets = new Map<string, Record<string, number>>();
    const start = new Date();
    start.setDate(start.getDate() - 13);
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      buckets.set(dayKey(d.toISOString()), {});
    }
    const keys = Array.from(buckets.keys());
    for (const a of analyses) {
      const k = dayKey(a.analysisTimestamp);
      if (!k) continue;
      const bucket = buckets.get(k);
      if (!bucket) continue;
      bucket[a.analysisType || 'analysis'] = (bucket[a.analysisType || 'analysis'] || 0) + 1;
    }
    for (const s of sessions) {
      const k = dayKey(s.startTime);
      if (!k) continue;
      const bucket = buckets.get(k);
      if (!bucket) continue;
      bucket.sessions = (bucket.sessions || 0) + 1;
    }
    const points = keys.map((k) => ({ label: dayLabel(k), buckets: buckets.get(k) || {} }));
    const hasActivity = points.some(p => Object.values(p.buckets).reduce((a, b) => a + b, 0) > 0);
    return hasActivity ? points : [];
  })();

  const statCards = [
    { label: 'Sandbox Sessions', value: sessions.length, icon: Boxes, cls: 'text-amber-700 bg-amber-50 border-amber-200', chip: 'bg-amber-100 text-amber-700' },
    { label: 'Telemetry Events', value: totalTelemetry, icon: Activity, cls: 'text-sky-700 bg-sky-50 border-sky-200', chip: 'bg-sky-100 text-sky-700' },
    { label: 'AI Analyses', value: analyses.length, icon: BrainCircuit, cls: 'text-violet-700 bg-violet-50 border-violet-200', chip: 'bg-violet-100 text-violet-700' },
    { label: 'Critical Patterns', value: dashboardData?.summary.criticalPatterns ?? 0, icon: ShieldAlert, cls: 'text-red-700 bg-red-50 border-red-200', chip: 'bg-red-100 text-red-700' },
    { label: 'High-Severity Insights', value: dashboardData?.summary.highSeverityInsights ?? 0, icon: AlertOctagon, cls: 'text-orange-700 bg-orange-50 border-orange-200', chip: 'bg-orange-100 text-orange-700' },
    { label: 'IOC Indicators', value: iocTotal, icon: Fingerprint, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', chip: 'bg-emerald-100 text-emerald-700' },
    { label: 'Evidence Items', value: evidenceTotal, icon: FileCheck2, cls: 'text-slate-700 bg-slate-50 border-slate-200', chip: 'bg-slate-100 text-slate-700' },
    { label: 'Active Alerts', value: alertsTotal, icon: BellRing, cls: 'text-rose-700 bg-rose-50 border-rose-200', chip: 'bg-rose-100 text-rose-700' },
  ];

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="max-w-[1400px] mx-auto py-6 px-4">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="eyebrow">Intelligence · Activity Analytics</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-[var(--text-primary)]  font-display tracking-tight">Forensic Analytics</h1>
            <span className="stamp">TELECOM AUDIT</span>
          </div>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)] ">
            Platform-wide activity · MITRE ATT&CK coverage · Behavioral patterns · Investigation correlation
          </p>
        </motion.div>

        {/* Activity stat row */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.04 }}
              className="rounded-xl border border-[var(--border-subtle)] bg-white p-4 flex flex-col gap-2"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.chip}`}>
                <card.icon className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">{card.value}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-[var(--text-tertiary)]">{card.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Session posture strip */}
        {sessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex flex-wrap items-center gap-2 mb-6"
          >
            <span className="text-xs font-mono uppercase tracking-wide text-[var(--text-tertiary)] mr-1">Session posture</span>
            <span className="px-2.5 py-1 text-xs font-mono rounded-full border border-[var(--border-subtle)] bg-[var(--surface-container-low)] text-[var(--text-secondary)]">
              avg severity {avgSessionScore}
            </span>
            <span className="px-2.5 py-1 text-xs font-mono rounded-full border border-orange-200 bg-orange-50 text-orange-700">
              {highRiskSessions} high/critical
            </span>
            <span className="px-2.5 py-1 text-xs font-mono rounded-full border border-rose-200 bg-rose-50 text-rose-700">
              {suspiciousEvents} suspicious events
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Clock className="w-3 h-3" /> {sessions.filter(s => s.status === 'completed').length} completed
            </span>
          </motion.div>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Verdict distribution */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border border-[var(--border-subtle)] bg-white p-4"
          >
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-3">Analysis Verdicts</p>
            {analyses.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] py-4">No analyses run yet</p>
            ) : (
              <div className="space-y-2.5">
                {verdictCounts.filter(v => v.count > 0).map((v) => {
                  const sev = SEVERITY_LIGHT[v.key] || SEVERITY_LIGHT.info;
                  return (
                    <div key={v.key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className={`inline-flex items-center gap-1.5 capitalize ${sev.text}`}>
                          <span className={`w-2 h-2 rounded-full ${sev.dot}`} />
                          {v.key}
                        </span>
                        <span className="text-[var(--text-primary)] font-mono">{v.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--surface-container)] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(2, (v.count / maxVerdict) * 100)}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className={`h-full rounded-full ${sev.dot}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Analysis type distribution */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34 }}
            className="rounded-xl border border-[var(--border-subtle)] bg-white p-4"
          >
            <CategoryDistributionChart data={typeSlices} total={analyses.length} title="Analysis Types" />
          </motion.div>

          {/* Threat pattern breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
            className="rounded-xl border border-[var(--border-subtle)] bg-white p-4"
          >
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-3">Behavioral Patterns</p>
            {!dashboardData || dashboardData.patterns.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] py-4">No behavioral patterns detected yet</p>
            ) : (
              <div className="space-y-2">
                {dashboardData.patterns.slice(0, 8).map((p, i) => {
                  const sev = SEVERITY_LIGHT[p.severity] || SEVERITY_LIGHT.info;
                  return (
                    <motion.div
                      key={p.patternId || `pattern-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.04 }}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container-lowest)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{p.name}</p>
                        <p className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wide">{p.category}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full border capitalize ${sev.bg} ${sev.text}`}>
                        {p.severity}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Activity timeline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42 }}
          className="rounded-xl border border-[var(--border-subtle)] bg-white p-4 mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Activity Timeline · Last 14 days</p>
            <p className="text-[10px] font-mono text-[var(--text-tertiary)]">{analyses.length} analyses · {sessions.length} sessions</p>
          </div>
          <EventTimelineChart points={timelinePoints} title="Daily Activity" />
        </motion.div>

        {/* MITRE ATT&CK Coverage */}
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
          <div className="rounded-xl border border-[var(--border-subtle)]  bg-white  backdrop-blur p-4 overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]  font-mono">MITRE ATT&CK Coverage</h2>
              <span className="px-2.5 py-1 text-xs font-mono rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                {detectedTechniques.length} techniques observed
              </span>
            </div>
            <div className="grid grid-cols-11 gap-1 min-w-[1100px]">
              {MITRE_TACTICS.map((tactic, i) => (
                <motion.div
                  key={tactic.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.04 }}
                  className="text-center pb-2 border-b border-[var(--border-subtle)] "
                >
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wide">{tactic.name}</span>
                </motion.div>
              ))}

              {Array.from({ length: 4 }).map((_, row) => (
                MITRE_TACTICS.map((tactic, col) => {
                  const techniques = MITRE_TECHNIQUES[tactic.id] || [];
                  const tech = techniques[row];
                  if (!tech) return <div key={`${tactic.id}-${row}`} className="h-10" />;

                  const detected = isDetected(tech.id);
                  const glowClass = getCellGlow(tech.id);

                  return (
                    <motion.div
                      key={tech.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + (row * 11 + col) * 0.02 }}
                      onClick={() => setExpandedTechnique(expandedTechnique === tech.id ? null : tech.id)}
                      className={`h-10 rounded cursor-pointer flex items-center justify-center transition-all duration-300 ${
                        detected
                          ? `bg-[var(--surface-container-low)]  ${glowClass}`
                          : 'bg-[var(--surface-container-lowest)]  hover:bg-[var(--surface-container-low)] '
                      }`}
                      title={detected ? `${tech.name} — detected` : tech.name}
                    >
                      <span className={`text-[9px] font-mono text-center px-1 ${detected ? 'text-[var(--text-primary)] ' : 'text-[var(--text-secondary)] '}`}>
                        {tech.name}
                      </span>
                    </motion.div>
                  );
                })
              ))}
            </div>

            <AnimatePresence>
              {expandedTechnique && (() => {
                const tech = detectedTechniques.find(t => t.technique_id === expandedTechnique);
                if (!tech) return null;
                return (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 rounded-lg border border-amber-500/30 bg-[var(--surface-container-lowest)]  p-4 overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <span className="font-mono text-amber-700 text-sm">{tech.technique_id}</span>
                      <span className="text-[var(--text-primary)] font-medium">{tech.technique_name}</span>
                      <span className="px-2 py-0.5 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded">{tech.tactic}</span>
                      <span className="text-xs text-[var(--text-secondary)]">Confidence: {(tech.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="space-y-1">
                      {tech.evidence_snippets.map((snippet, i) => (
                        <div key={i} className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--surface-container-low)] rounded px-3 py-1.5 border-l-2 border-amber-500/40">
                          {snippet}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Correlation Insights */}
        {dashboardData && dashboardData.insights.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-6">
            <div className="rounded-xl border border-[var(--border-subtle)]  bg-white  backdrop-blur p-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]  font-mono mb-3">Correlation Insights</h2>
              <div className="space-y-2">
                {dashboardData.insights.slice(0, 5).map((insight, i) => (
                  <motion.div
                    key={insight.insightId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                    className={`p-3 rounded-lg border ${
                      insight.severity === 'critical' ? 'border-red-200 bg-red-50/60' :
                      insight.severity === 'high' ? 'border-orange-200 bg-orange-50/60' :
                      'border-[var(--border-subtle)]  bg-white '
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-[var(--text-primary)]  font-medium">{insight.title}</p>
                      {insight.severity === 'critical' || insight.severity === 'high' ? (
                        <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full border capitalize ${
                          SEVERITY_LIGHT[insight.severity]?.bg || ''} ${SEVERITY_LIGHT[insight.severity]?.text || ''}`}
                        >
                          {insight.severity}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]  mt-1">{insight.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ForensicAnalyticsPage;
