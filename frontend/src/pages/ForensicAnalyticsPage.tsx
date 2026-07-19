import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

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

export const ForensicAnalyticsPage = () => {
  const [detectedTechniques, _setDetectedTechniques] = useState<DetectedTechnique[]>([]);
  const [expandedTechnique, setExpandedTechnique] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsRes] = await Promise.all([
        api.get<DashboardData>('/analytics/dashboard'),
      ]);
      if (analyticsRes.success && analyticsRes.data) setDashboardData(analyticsRes.data);
    } catch { /* empty state */ }
    setLoading(false);
  };

  const isDetected = (techniqueId: string): DetectedTechnique | undefined => {
    return detectedTechniques.find(t => t.technique_id === techniqueId);
  };

  const getCellGlow = (techniqueId: string): string => {
    const hit = isDetected(techniqueId);
    if (!hit) return '';
    if (hit.confidence >= 0.8) return 'ring-2 ring-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.3)]';
    if (hit.confidence >= 0.5) return 'ring-2 ring-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.25)]';
    return 'ring-1 ring-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.15)]';
  };

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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-mono tracking-tight">Forensic Analytics</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">MITRE ATT&CK matrix · Behavioral patterns · Investigation correlation</p>
        </motion.div>

        {dashboardData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Clusters', value: dashboardData.summary.totalClusters, color: 'amber' },
              { label: 'High Severity', value: dashboardData.summary.highSeverityInsights, color: 'red' },
              { label: 'Patterns', value: dashboardData.summary.totalPatterns, color: 'violet' },
              { label: 'Critical', value: dashboardData.summary.criticalPatterns, color: 'orange' },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className={`rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-br from-${card.color}-500/10 to-transparent p-4 backdrop-blur`}
              >
                <div className={`text-3xl font-bold font-mono text-${card.color}-400`}>{card.value}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.label}</div>
              </motion.div>
            ))}
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
          <div className="rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-800/80 backdrop-blur p-4 overflow-x-auto">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white font-mono mb-4">MITRE ATT&CK Coverage</h2>
            <div className="grid grid-cols-11 gap-1 min-w-[1100px]">
              {MITRE_TACTICS.map((tactic, i) => (
                <motion.div
                  key={tactic.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.04 }}
                  className="text-center pb-2 border-b border-slate-200/50 dark:border-slate-700/50"
                >
                  <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wide">{tactic.name}</span>
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
                          ? `bg-slate-100/80 dark:bg-slate-700/80 ${glowClass}`
                          : 'bg-slate-50/40 dark:bg-slate-800/40 hover:bg-slate-100/40 dark:hover:bg-slate-700/40'
                      }`}
                    >
                      <span className={`text-[9px] font-mono text-center px-1 ${detected ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
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
                    className="mt-4 rounded-lg border border-amber-500/30 bg-slate-50/60 dark:bg-slate-700/60 p-4 overflow-hidden"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-amber-400 text-sm">{tech.technique_id}</span>
                      <span className="text-slate-900 dark:text-white font-medium">{tech.technique_name}</span>
                      <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded">{tech.tactic}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Confidence: {(tech.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="space-y-1">
                      {tech.evidence_snippets.map((snippet, i) => (
                        <div key={i} className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 rounded px-3 py-1.5 border-l-2 border-amber-500/40">
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

        {dashboardData && dashboardData.insights.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-6">
            <div className="rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-800/80 backdrop-blur p-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white font-mono mb-3">Correlation Insights</h2>
              <div className="space-y-2">
                {dashboardData.insights.slice(0, 5).map((insight, i) => (
                  <motion.div
                    key={insight.insightId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                    className={`p-3 rounded-lg border ${
                      insight.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                      insight.severity === 'high' ? 'border-orange-500/30 bg-orange-500/5' :
                      'border-slate-200/30 dark:border-slate-700/30 bg-white dark:bg-slate-800/80'
                    }`}
                  >
                    <p className="text-sm text-slate-400 dark:text-slate-300 font-medium">{insight.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{insight.description}</p>
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
