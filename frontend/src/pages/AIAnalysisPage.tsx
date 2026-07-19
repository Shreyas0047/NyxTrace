/**
 * AI Analysis Page
 * Enterprise forensic intelligence workspace with real-time threat analysis
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Brain,
  Shield,
  Target,
  AlertTriangle,
  Activity,
  FileText,
  Network,
  Cpu,
  Lock,
  Terminal,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  XCircle,
  GitCompare,
  GitBranch,
  Link2,
  X,
  AlertCircle,
  Layers,
  Globe,
  FileSearch,
  LayoutDashboard,
  Square,
} from 'lucide-react';
import { useAnalysisStore } from '../stores/analysisStore';
import { useSandboxStore } from '../stores/sandboxStore';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useReportsStore } from '../stores/reportsStore';
import { cn } from '../design-system';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageGrid } from '../layouts/PageContainer';
import { DashboardCard, DashboardStat } from '../components/enterprise/DashboardGrid';
import { AttackChain } from '../components/visualizations/AttackChain';
import { EvidenceGraph } from '../components/visualizations/EvidenceGraph';
import { MITREHeatmap } from '../components/visualizations/MITREHeatmap';
import { RiskScoreGauge } from '../components/visualizations/RiskScoreGauge';
import { motion, AnimatePresence } from 'framer-motion';
import { DocumentAnalysisView } from '../components/threat-intelligence/DocumentAnalysisView';
import { UrlAnalysisView } from '../components/threat-intelligence/UrlAnalysisView';
import { ThreatSummaryBar } from '../components/threat-intelligence/ThreatSummaryBar';
import { AnalysisResultCard } from '../components/threat-intelligence/AnalysisResultCard';
import { useThreatIntelStore } from '../stores/threatIntelStore';
import api from '../services/api';

type TabType = 'overview' | 'threat' | 'mitre' | 'chain' | 'heuristics' | 'anomalies' | 'compare';
type AnalysisMode = 'sandbox' | 'document' | 'url' | 'workspace';

interface BehavioralHeuristic {
  name: string;
  triggered: boolean;
  severity: string;
  confidence: number;
  description: string;
}

interface AnomalyData {
  type: string;
  description: string;
  severity: string;
  deviationScore: number;
  timestamp: string;
  indicators: string[];
}

interface ChainStage {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'completed' | 'in-progress' | 'detected' | 'blocked' | 'pending';
  timestamp?: string;
  events: number;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  description?: string;
}

const severityBadgeColors = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'critical': return <AlertTriangle className="w-4 h-4" />;
    case 'high': return <AlertCircle className="w-4 h-4" />;
    case 'medium': return <AlertTriangle className="w-4 h-4" />;
    default: return <CheckCircle className="w-4 h-4" />;
  }
};

const getTrendIcon = (value: number) => {
  if (value > 0) return <TrendingUp className="w-4 h-4 text-red-400" />;
  if (value < 0) return <TrendingDown className="w-4 h-4 text-emerald-400" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
};

export function AIAnalysisPage() {
  const {
    currentReport,
    currentSessionAnalysis,
    isLoadingReport,
    reportError,
    isLoadingInsights,
    comparisonResult,
    isComparing,
    liveEvents,
    isLiveAnalyzing,
    analyzeSession,
    compareSessions,
    startLiveAnalysis,
    updateLiveEvents,
    stopLiveAnalysis,
    loadPatterns,
    loadInsights,
    clearReport,
  } = useAnalysisStore();

  const {
    sessions,
    activeSession,
    fetchSessions,
    terminateSession,
    stopSession,
    isExecuting,
  } = useSandboxStore();

  const telemetryStore = useTelemetryStore();
  const telemetryEvents = telemetryStore.events;
  const connectTelemetry = telemetryStore.connect;
  const disconnectTelemetry = telemetryStore.disconnect;

  const {
    fetchReports,
  } = useReportsStore();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedSessionForAnalysis, setSelectedSessionForAnalysis] = useState('');
  const [expandedTechnique, setExpandedTechnique] = useState<string | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('sandbox');
  const [selectedComparisonSessions, setSelectedComparisonSessions] = useState<string[]>([]);
  const [storedAIAnalysis, setStoredAIAnalysis] = useState<any>(null);
  const [isLoadingStoredAnalysis, setIsLoadingStoredAnalysis] = useState(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchSessions({ page: 1, limit: 50 });
    fetchReports();
    loadPatterns();
    loadInsights();
  }, [fetchSessions, fetchReports, loadPatterns, loadInsights]);

  const sessionId = activeSession?.session_id;
  const sessionState = activeSession?.state;

  useEffect(() => {
    const isLive = sessionId && sessionState !== 'completed' && sessionState !== 'failed';
    if (isLive) {
      startLiveAnalysis(sessionId);
      if (!telemetryStore.isConnected) {
        connectTelemetry();
      }
    }
    return () => {
      stopLiveAnalysis();
      if (telemetryStore.isConnected) {
        disconnectTelemetry();
      }
    };
  }, [sessionId, sessionState, startLiveAnalysis, connectTelemetry, stopLiveAnalysis, disconnectTelemetry, telemetryStore.isConnected]);

  const eventsRef = useRef(telemetryEvents);

  useEffect(() => {
    eventsRef.current = telemetryEvents;
  }, [telemetryEvents]);

  useEffect(() => {
    if (isLiveAnalyzing) {
      updateLiveEvents(eventsRef.current.length);
      refreshIntervalRef.current = setInterval(() => {
        updateLiveEvents(eventsRef.current.length);
      }, 1000);
    }
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [isLiveAnalyzing, updateLiveEvents]);

  useEffect(() => {
    if (!selectedSessionForAnalysis) {
      setStoredAIAnalysis(null);
      return;
    }
    const session = sessions.find(s => s.sessionId === selectedSessionForAnalysis);
    if (session?.status !== 'completed' && session?.status !== 'failed') {
      setStoredAIAnalysis(null);
      return;
    }
    setIsLoadingStoredAnalysis(true);
    api.getSessionAIAnalysis(selectedSessionForAnalysis)
      .then(res => {
        if (res.data?.aiAnalysis) {
          setStoredAIAnalysis(res.data.aiAnalysis);
        } else {
          setStoredAIAnalysis(null);
        }
      })
      .catch((err) => { console.error('Failed to fetch stored AI analysis:', err); setStoredAIAnalysis(null); })
      .finally(() => setIsLoadingStoredAnalysis(false));
  }, [selectedSessionForAnalysis, sessions]);

  const handleAnalyzeSession = useCallback(async () => {
    if (selectedSessionForAnalysis) {
      await analyzeSession(selectedSessionForAnalysis);
      setActiveTab('overview');
    }
  }, [selectedSessionForAnalysis, analyzeSession]);

  const handleTerminateSession = useCallback(async () => {
    if (!activeSession) return;
    stopLiveAnalysis();
    disconnectTelemetry();
    await terminateSession(activeSession.session_id);
    fetchSessions({ page: 1, limit: 50 });
  }, [activeSession, stopLiveAnalysis, disconnectTelemetry, terminateSession, fetchSessions]);

  const handleStopSession = useCallback(async () => {
    if (!activeSession) return;
    stopLiveAnalysis();
    disconnectTelemetry();
    await stopSession(activeSession.session_id);
    fetchSessions({ page: 1, limit: 50 });
  }, [activeSession, stopLiveAnalysis, disconnectTelemetry, stopSession, fetchSessions]);

  const handleCompareSessions = useCallback(async () => {
    if (selectedComparisonSessions.length === 2) {
      await compareSessions(selectedComparisonSessions);
      setShowCompareModal(false);
      setActiveTab('compare');
    }
  }, [selectedComparisonSessions, compareSessions]);

  const handleSessionToggle = useCallback((sessionId: string) => {
    setSelectedComparisonSessions(prev => {
      if (prev.includes(sessionId)) return prev.filter(id => id !== sessionId);
      if (prev.length >= 2) return prev;
      return [...prev, sessionId];
    });
  }, []);

  const sessionAnalysis = (currentSessionAnalysis || storedAIAnalysis) as any;

  const {
    analysisHistory,
    summary: threatIntelSummary,
    isLoading: threatIntelLoading,
    loadHistory,
    loadAnalysis: loadThreatAnalysis,
  } = useThreatIntelStore();

  const threatClassification = (() => {
    if (currentReport?.threatClassification) {
      return currentReport.threatClassification;
    }
    const source = currentSessionAnalysis || storedAIAnalysis;
    if (source) {
      return {
        threatType: sessionAnalysis?.predictedThreat || (source.threatClassification ? Object.keys(source.threatClassification)[0] : 'Unknown'),
        confidence: source.confidence || 0,
        severityLevel: source.severityLevel || 'medium',
        severityScore: source.severityScore || 0,
        reasons: sessionAnalysis?.reasons || [],
      };
    }
    return null;
  })();

  const mitreTechniques: any[] = currentReport?.mitreTechniques || (sessionAnalysis as any)?.mitreTechniques || [];

  const behavioralHeuristics: BehavioralHeuristic[] = currentReport?.behavioralHeuristics || sessionAnalysis?.behavioralHeuristics || [];

  const anomalyData: AnomalyData[] = (currentReport?.anomalies || currentSessionAnalysis?.anomalies || storedAIAnalysis?.anomalies || []).map((anomaly: any) => ({
    type: anomaly.type || anomaly.category || 'Unknown',
    description: anomaly.description || '',
    severity: anomaly.severity || 'medium',
    deviationScore: anomaly.deviationScore ?? anomaly.deviation_score ?? 0,
    timestamp: anomaly.timestamp || new Date().toISOString(),
    indicators: anomaly.indicators || anomaly.relatedEvents || [],
  }));

  const sourceStages = currentReport?.attackChain?.stages || sessionAnalysis?.attackChain?.stages || [];
  const attackChainStages: ChainStage[] = sourceStages.map((s: any, i: number) => ({
    id: `stage_${i}`,
    name: s.stageName || s.name || `Stage ${i + 1}`,
    icon: i === 0 ? Shield : i === 1 ? Terminal : i === 2 ? Lock : i === 3 ? Activity : i === 4 ? Network : i === 5 ? FileText : Target,
    status: s.status || 'detected',
    timestamp: s.timestamp || new Date().toISOString(),
    events: s.events || 0,
    severity: s.severity || 'medium',
    description: s.description || '',
  }));

  const evidenceGraphNodes = (currentReport as any)?.evidenceGraph?.nodes || [];
  const evidenceGraphEdges = (currentReport as any)?.evidenceGraph?.edges || [];

  const executiveSummary = currentReport?.executiveSummary || currentSessionAnalysis?.behavioralSummary || storedAIAnalysis?.behavioralSummary || '';

  const analystExplanation = currentReport?.analystExplanation || sessionAnalysis?.analystExplanation || currentSessionAnalysis?.behavioralSummary || storedAIAnalysis?.behavioralSummary || '';


  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">AI Analysis Engine</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Real-time forensic intelligence and threat analysis</p>
        </div>
        <div className="flex items-center gap-3">
          {isLiveAnalyzing && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 rounded-lg border border-red-500/30">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-red-400 font-medium">Live: {liveEvents} events</span>
            </div>
          )}
            {activeSession && (
            <button
              onClick={handleTerminateSession}
              disabled={isExecuting}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Terminate
            </button>
          )}
          <button
            onClick={() => loadInsights()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={cn('w-4 h-4', isLoadingInsights && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Analysis Mode Selector */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg w-fit">
        {([
          { id: 'sandbox' as const, label: 'Sandbox', icon: Cpu },
          { id: 'document' as const, label: 'Document', icon: FileSearch },
          { id: 'url' as const, label: 'URL Intel', icon: Globe },
          { id: 'workspace' as const, label: 'Workspace', icon: LayoutDashboard },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAnalysisMode(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all',
              analysisMode === id
                ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {analysisMode === 'sandbox' ? (
      <>
      <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <div className="flex items-center gap-2">
          <select
            value={selectedSessionForAnalysis}
            onChange={(e) => setSelectedSessionForAnalysis(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-72"
          >
            <option value="">Select session for analysis...</option>
            {sessions.map(s => (
              <option key={s.id} value={s.sessionId}>{s.simulatorName} ({s.sessionId?.slice(0, 8)})</option>
            ))}
          </select>
          <button
            onClick={handleAnalyzeSession}
            disabled={!selectedSessionForAnalysis || isLoadingReport || !!storedAIAnalysis}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-amber-500 text-black rounded-lg hover:bg-amber-400 disabled:opacity-50"
          >
            {isLoadingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            Analyze Session
          </button>
        </div>
        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />
        <button
          onClick={() => setShowCompareModal(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <GitCompare className="w-4 h-4" />
          Compare Sessions
        </button>
      </div>

      {isLoadingStoredAnalysis && (
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700/50 rounded-lg text-sm text-indigo-700 dark:text-indigo-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading stored AI analysis...
        </div>
      )}

      {storedAIAnalysis && !isLoadingStoredAnalysis && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700/50 rounded-lg text-sm"
        >
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="text-emerald-800 dark:text-emerald-200">
            <span className="font-semibold">AI analysis available</span> from session completion pipeline.
            {storedAIAnalysis.confidence ? (
              <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                Confidence: {(storedAIAnalysis.confidence * 100).toFixed(0)}%
              </span>
            ) : null}
          </div>
          <button
            onClick={() => setStoredAIAnalysis(null)}
            className="ml-auto text-xs px-2 py-1 rounded bg-emerald-200/50 dark:bg-emerald-800/50 hover:bg-emerald-200 dark:hover:bg-emerald-700/50 text-emerald-700 dark:text-emerald-300"
          >
            Re-analyze
          </button>
        </motion.div>
      )}

      {isLiveAnalyzing && activeSession && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-gradient-to-r from-violet-500 to-purple-500 rounded-lg flex items-center justify-between text-white"
        >
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <div>
              <p className="font-semibold">Live Analysis: {activeSession.simulator_id || 'Unknown'}</p>
              <p className="text-sm text-violet-100">Session ID: {activeSession.session_id?.slice(0, 12)}...</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{liveEvents}</p>
              <p className="text-xs text-violet-100">Events Captured</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{telemetryEvents.length}</p>
              <p className="text-xs text-violet-100">Telemetry Items</p>
            </div>
            <button
              onClick={handleStopSession}
              disabled={isExecuting}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
            <button
              onClick={handleTerminateSession}
              disabled={isExecuting}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-500/30 hover:bg-red-500/40 rounded-lg transition-colors disabled:opacity-50"
            >
              {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Terminate
            </button>
          </div>
        </motion.div>
      )}

      <PageGrid columns={4}>
        <DashboardCard>
          <DashboardStat
            label="Threat Confidence"
            value={threatClassification ? `${((threatClassification.confidence) * 100).toFixed(0)}%` : '—'}
            icon={<Shield className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
            delta={threatClassification ? 'Based on behavioral analysis' : 'No analysis data'}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="MITRE Techniques"
            value={mitreTechniques.length || '—'}
            icon={<Target className="w-5 h-5 text-amber-400" />}
            delta={mitreTechniques.length ? 'Attack pattern mapping' : 'No techniques mapped'}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Heuristics Triggered"
            value={behavioralHeuristics.length ? behavioralHeuristics.filter(h => h.triggered).length : '—'}
            icon={<Activity className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
            delta={behavioralHeuristics.length ? `of ${behavioralHeuristics.length} total` : 'No heuristics data'}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Anomalies Detected"
            value={anomalyData.length || '—'}
            icon={<AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />}
            delta={anomalyData.length ? 'Behavioral deviations' : 'No anomalies detected'}
          />
        </DashboardCard>
      </PageGrid>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {([
          { id: 'overview', label: 'Overview', icon: Layers },
          { id: 'threat', label: 'Threat Classification', icon: Shield },
          { id: 'mitre', label: 'MITRE ATT&CK', icon: Target },
          { id: 'chain', label: 'Attack Chain', icon: GitBranch },
          { id: 'heuristics', label: 'Heuristics', icon: Activity },
          { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
          { id: 'compare', label: 'Comparison', icon: GitCompare },
        ] as { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === id
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-violet-600" />
                  Threat Classification
                </h3>
              </div>
              <div className="p-4">
                {threatClassification ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{threatClassification.threatType}</p>
                        <p className="text-sm text-slate-500">Primary Threat Classification</p>
                      </div>
                      <RiskScoreGauge
                        score={threatClassification.severityScore * 10}
                        size="md"
                        label="Risk Score"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Confidence Score</span>
                        <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                          {(threatClassification.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${threatClassification.confidence * 100}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                          className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
                        />
                      </div>
                    </div>
                    <div className={cn('p-3 rounded-lg border text-sm', severityBadgeColors[threatClassification.severityLevel as keyof typeof severityBadgeColors])}>
                      <span className="font-medium capitalize">{threatClassification.severityLevel}</span> severity level
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Select a session to analyze</p>
                    <p className="text-xs mt-1">AI analysis will identify threats and behaviors</p>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Top Anomalies
                </h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {anomalyData.length > 0 ? anomalyData.slice(0, 3).map((anomaly, idx) => (
                  <div key={idx} className="p-4 flex items-start gap-3">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                      anomaly.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/20' :
                      anomaly.severity === 'high' ? 'bg-orange-100 dark:bg-orange-900/20' :
                      'bg-amber-100 dark:bg-amber-900/20'
                    )}>
                      {getSeverityIcon(anomaly.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{anomaly.type}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{anomaly.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full',
                                anomaly.severity === 'critical' ? 'bg-red-500' :
                                anomaly.severity === 'high' ? 'bg-orange-500' : 'bg-amber-500'
                              )}
                              style={{ width: `${anomaly.deviationScore * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400">{(anomaly.deviationScore * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-slate-500">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No anomalies detected</p>
                    <p className="text-xs mt-1">Anomalies will appear after analysis</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-400" />
                  MITRE ATT&CK Coverage
                </h3>
              </div>
              <div className="p-4">
                {mitreTechniques.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {mitreTechniques.slice(0, 4).map((tech: any) => (
                      <div key={tech.id} className="p-3 rounded-lg border bg-slate-50 border-slate-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 text-xs font-mono bg-amber-500/15 text-amber-700 rounded">
                            {tech.id}
                          </span>
                          <span className="text-xs text-slate-400">{tech.tactic}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800">{tech.name}</p>
                        <div className="flex items-center gap-1 mt-2">
                          <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${tech.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{(tech.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No MITRE techniques mapped</p>
                    <p className="text-xs mt-1">Techniques will appear after analysis</p>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  Behavioral Heuristics
                </h3>
              </div>
              <div className="p-4 space-y-2">
                {behavioralHeuristics.length > 0 ? behavioralHeuristics.slice(0, 4).map((heuristic, idx) => (
                  <div key={idx} className={cn(
                    'flex items-center gap-3 p-3 rounded-lg',
                    heuristic.triggered
                      ? 'bg-red-500/10 border border-red-500/20'
                      : 'bg-slate-50 border border-slate-200'
                  )}>
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      heuristic.triggered ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-200 dark:bg-slate-700'
                    )}>
                      {heuristic.triggered ? (
                        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{heuristic.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{heuristic.description}</p>
                    </div>
                    <span className={cn(
                      'px-2 py-0.5 text-xs font-medium rounded capitalize',
                      heuristic.triggered
                        ? heuristic.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                          heuristic.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-amber-500/20 text-amber-400'
                        : 'bg-slate-600/30 text-slate-400'
                    )}>
                      {heuristic.triggered ? heuristic.severity : 'safe'}
                    </span>
                  </div>
                )) : (
                  <div className="text-center py-8 text-slate-500">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No heuristics triggered</p>
                    <p className="text-xs mt-1">Heuristics will appear after analysis</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'threat' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                <h3 className="font-semibold text-slate-900 dark:text-white">Threat Classification Details</h3>
              </div>
              <div className="p-6">
                {threatClassification ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-4xl font-bold text-violet-600 dark:text-violet-400">
                          {(threatClassification.confidence * 100).toFixed(0)}%
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Confidence</p>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <span className={cn(
                            'px-3 py-1.5 text-sm font-semibold rounded-lg capitalize',
                            severityBadgeColors[threatClassification.severityLevel as keyof typeof severityBadgeColors]
                          )}>
                            {threatClassification.severityLevel}
                          </span>
                          <span className="text-2xl font-bold text-slate-900 dark:text-white">
                            {threatClassification.threatType}
                          </span>
                        </div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${threatClassification.confidence * 100}%` }}
                            transition={{ duration: 1.5, ease: 'easeOut' }}
                            className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Classification Reasons</h4>
                      <div className="space-y-2">
                        {(threatClassification.reasons || []).map((reason: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                              <span className="text-xs font-bold text-violet-600 dark:text-violet-400">{idx + 1}</span>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">{reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {currentSessionAnalysis && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Threat Probability Distribution</h4>
                        <div className="space-y-2">
                          {Object.entries(currentSessionAnalysis.threatClassification).map(([type, prob]) => (
                            <div key={type} className="flex items-center gap-3">
                              <span className="text-sm text-slate-600 dark:text-slate-400 w-40">{type}</span>
                              <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(prob as number) * 100}%` }}
                                  transition={{ duration: 1, delay: 0.2 }}
                                  className={cn(
                                    'h-full rounded-full',
                                    (prob as number) > 0.5 ? 'bg-red-500' :
                                    (prob as number) > 0.2 ? 'bg-amber-500' : 'bg-emerald-500'
                                  )}
                                />
                              </div>
                              <span className="text-sm font-mono text-slate-600 dark:text-slate-400 w-12">
                                {((prob as number) * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Shield className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <p className="text-slate-500">No threat classification available</p>
                    <p className="text-xs text-slate-400 mt-1">Analyze a session to generate threat classification</p>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                <h3 className="font-semibold text-slate-900 dark:text-white">Attack Chain Progression</h3>
              </div>
              <div className="p-4">
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500 via-amber-500 to-slate-300" />
                  <div className="space-y-3">
                    {attackChainStages.slice(0, 5).map((stage, _idx) => (
                      <div key={stage.id} className="relative flex items-center gap-4 pl-12">
                        <div className={cn(
                          'absolute left-2 w-4 h-4 rounded-full border-2 z-10',
                          stage.status === 'completed' && 'bg-emerald-500 border-emerald-500',
                          stage.status === 'in-progress' && 'bg-amber-500 border-amber-500 animate-pulse',
                          stage.status === 'detected' && 'bg-amber-500 border-amber-500',
                          stage.status === 'pending' && 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                        )} />
                        <div className={cn(
                          'flex-1 p-3 rounded-lg border',
                          stage.status === 'completed' && 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30',
                          stage.status === 'in-progress' && 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30',
                          stage.status === 'pending' && 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/50 opacity-50'
                        )}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">{stage.name}</span>
                            <span className="text-xs text-slate-500">{stage.events} events</span>
                          </div>
                          {stage.description && (
                            <p className="text-xs text-slate-500 mt-1">{stage.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                <h3 className="font-semibold text-slate-900 dark:text-white">Risk Score Gauge</h3>
              </div>
              <div className="p-6 flex justify-center">
                <RiskScoreGauge
                  score={threatClassification ? threatClassification.severityScore * 10 : 75}
                  size="lg"
                  label="Threat Severity"
                  animated
                />
              </div>
            </Card>

            <Card>
              <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                <h3 className="font-semibold text-slate-900 dark:text-white">Executive Summary</h3>
              </div>
              <div className="p-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line">
                    {executiveSummary}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'mitre' && (
        <div className="space-y-6">
          <MITREHeatmap
            data={mitreTechniques.map(tech => ({
              id: tech.tactic.toUpperCase().replace(' ', '_'),
              name: tech.tactic,
              techniques: [{
                id: tech.id,
                name: tech.name,
                count: Math.floor(tech.confidence * 10),
                severity: tech.confidence > 0.85 ? 'critical' as const : tech.confidence > 0.7 ? 'high' as const : 'medium' as const,
                description: tech.description,
              }],
            }))}
            title="MITRE ATT&CK Technique Coverage"
          />

          <Card>
            <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
              <h3 className="font-semibold text-slate-900 dark:text-white">Technique Details</h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {mitreTechniques.map((tech) => (
                <div key={tech.id} className="p-4">
                  <div
                    onClick={() => setExpandedTechnique(expandedTechnique === tech.id ? null : tech.id)}
                    className="flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 -mx-4 px-4 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 text-xs font-mono bg-amber-500/15 text-amber-700 rounded">
                        {tech.id}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{tech.name}</p>
                        <p className="text-xs text-slate-500">{tech.tactic}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${tech.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{(tech.confidence * 100).toFixed(0)}%</span>
                      </div>
                      {expandedTechnique === tech.id ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>
                  <AnimatePresence>
                    {expandedTechnique === tech.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-3 space-y-2"
                      >
                        <p className="text-sm text-slate-600 dark:text-slate-400">{tech.description}</p>
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1">Evidence:</p>
                          <div className="flex flex-wrap gap-1">
                            {tech.evidence.map((ev: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded font-mono">
                                {ev}
                              </span>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'chain' && (
        <div className="space-y-6">
          <AttackChain
            stages={attackChainStages}
            title="Attack Chain Reconstruction"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                <h3 className="font-semibold text-slate-900 dark:text-white">Chain Statistics</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <p className="text-3xl font-bold text-amber-400">
                    {attackChainStages.filter(s => s.status !== 'pending').length}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Stages Detected</p>
                </div>
                <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">
                    {attackChainStages.reduce((sum, s) => sum + s.events, 0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Total Events</p>
                </div>
                <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                    {attackChainStages.filter(s => s.severity === 'critical').length}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Critical Stages</p>
                </div>
                <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {attackChainStages.length > 0 ? `${((currentReport?.attackChain?.confidence || sessionAnalysis?.attackChain?.confidence || 0) * 100).toFixed(0)}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Chain Confidence</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                <h3 className="font-semibold text-slate-900 dark:text-white">Evidence Correlation Graph</h3>
              </div>
              <div className="p-4">
                <EvidenceGraph
                  nodes={evidenceGraphNodes}
                  edges={evidenceGraphEdges}
                  title=""
                />
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'heuristics' && (
        <div className="space-y-6">
          <PageGrid columns={2}>
            {behavioralHeuristics.map((heuristic, idx) => (
              <DashboardCard key={idx}>
                <div className={cn(
                  'p-4 rounded-xl border',
                  heuristic.triggered
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-slate-50 border-slate-200'
                )}>
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      heuristic.triggered
                        ? heuristic.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' :
                          heuristic.severity === 'high' ? 'bg-orange-100 dark:bg-orange-900/30' :
                          'bg-amber-100 dark:bg-amber-900/30'
                        : 'bg-slate-100 dark:bg-slate-700'
                    )}>
                      {heuristic.triggered ? (
                        <AlertTriangle className={cn(
                          'w-5 h-5',
                          heuristic.severity === 'critical' ? 'text-red-600 dark:text-red-400' :
                          heuristic.severity === 'high' ? 'text-orange-600 dark:text-orange-400' :
                          'text-amber-600 dark:text-amber-400'
                        )} />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{heuristic.name}</h4>
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded capitalize',
                          heuristic.triggered
                            ? heuristic.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                              heuristic.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-600/30 text-slate-400'
                        )}>
                          {heuristic.triggered ? heuristic.severity : 'not triggered'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">{heuristic.description}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Confidence:</span>
                        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${heuristic.confidence * 100}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.1 }}
                            className={cn(
                              'h-full rounded-full',
                              heuristic.confidence > 0.8 ? 'bg-red-500' :
                              heuristic.confidence > 0.6 ? 'bg-amber-500' : 'bg-emerald-500'
                            )}
                          />
                        </div>
                        <span className="text-xs font-mono text-slate-400">
                          {(heuristic.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </DashboardCard>
            ))}
          </PageGrid>

          <Card>
            <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
              <h3 className="font-semibold text-slate-900 dark:text-white">Analyst Explanation</h3>
            </div>
            <div className="p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="whitespace-pre-line text-sm text-slate-600 dark:text-slate-400">
                  {analystExplanation}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'anomalies' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {anomalyData.map((anomaly, idx) => (
              <Card key={idx}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center',
                        anomaly.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' :
                        anomaly.severity === 'high' ? 'bg-orange-100 dark:bg-orange-900/30' :
                        'bg-amber-100 dark:bg-amber-900/30'
                      )}>
                        {getSeverityIcon(anomaly.severity)}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{anomaly.type}</h4>
                        <p className="text-xs text-slate-500">{new Date(anomaly.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <span className={cn(
                      'px-2 py-0.5 text-xs font-medium rounded capitalize',
                      anomaly.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                      anomaly.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-amber-500/20 text-amber-400'
                    )}>
                      {anomaly.severity}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{anomaly.description}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Deviation Score</span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {(anomaly.deviationScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${anomaly.deviationScore * 100}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.1 }}
                        className={cn(
                          'h-full rounded-full',
                          anomaly.deviationScore > 0.9 ? 'bg-red-500' :
                          anomaly.deviationScore > 0.7 ? 'bg-orange-500' : 'bg-amber-500'
                        )}
                      />
                    </div>
                  </div>
                  {anomaly.indicators.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-medium text-slate-500 mb-2">Indicators:</p>
                      <div className="flex flex-wrap gap-1">
                        {anomaly.indicators.map((ind, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded font-mono">
                            {ind}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'compare' && (
        <div className="space-y-6">
          {comparisonResult ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-violet-500/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                      <Cpu className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Session 1</p>
                      <p className="text-xs text-slate-500 font-mono">{comparisonResult.session1.id.slice(0, 12)}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-500">Threat Type</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{comparisonResult.session1.threatType}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-500">Severity Score</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{comparisonResult.session1.severityScore}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-500">Heuristics Triggered</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{comparisonResult.session1.heuristicsTriggered}</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">MITRE Techniques:</p>
                    <div className="flex flex-wrap gap-1">
                      {comparisonResult.session1.mitreTechniques.map((tech) => (
                        <span key={tech} className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-400 rounded font-mono">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-amber-500/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 dark:bg-amber-900/30 flex items-center justify-center">
                      <Cpu className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Session 2</p>
                      <p className="text-xs text-slate-500 font-mono">{comparisonResult.session2.id.slice(0, 12)}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-500">Threat Type</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{comparisonResult.session2.threatType}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-500">Severity Score</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{comparisonResult.session2.severityScore}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-500">Heuristics Triggered</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{comparisonResult.session2.heuristicsTriggered}</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">MITRE Techniques:</p>
                    <div className="flex flex-wrap gap-1">
                      {comparisonResult.session2.mitreTechniques.map((tech) => (
                        <span key={tech} className="px-2 py-0.5 text-xs bg-amber-500/15 text-amber-700 rounded font-mono">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="lg:col-span-2">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Comparison Analysis</h3>
                </div>
                <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {comparisonResult.differences.threatTypeMatch ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <span className="text-sm font-medium">Threat Match</span>
                    </div>
                    <p className="text-xs text-slate-500">{comparisonResult.differences.threatTypeMatch ? 'Same threat type' : 'Different threat types'}</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {getTrendIcon(-comparisonResult.differences.severityDelta)}
                      <span className="text-sm font-medium">Severity Delta</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {comparisonResult.differences.severityDelta.toFixed(1)}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Link2 className="w-5 h-5 text-amber-500" />
                      <span className="text-sm font-medium">Shared Techniques</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {comparisonResult.differences.sharedTechniques.length}
                    </p>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-700/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">Unique to Session 1:</p>
                      <div className="flex flex-wrap gap-1">
                        {comparisonResult.differences.uniqueToSession1.map((tech) => (
                          <span key={tech} className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-400 rounded font-mono">
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">Unique to Session 2:</p>
                      <div className="flex flex-wrap gap-1">
                        {comparisonResult.differences.uniqueToSession2.map((tech) => (
                          <span key={tech} className="px-2 py-0.5 text-xs bg-amber-500/15 text-amber-700 rounded font-mono">
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <Card>
              <div className="flex flex-col items-center justify-center py-16">
                <GitCompare className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
                <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">Session Comparison</p>
                <p className="text-sm text-slate-500 mb-4">Select two sessions to compare their forensic analysis</p>
                <Button onClick={() => setShowCompareModal(true)}>
                  Select Sessions
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      <Modal isOpen={showCompareModal} onClose={() => setShowCompareModal(false)} title="Compare Sessions" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Select two sessions to compare their forensic analysis results.</p>

          <div className="grid grid-cols-2 gap-4 max-h-80 overflow-y-auto p-1">
            {sessions.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-slate-500">
                <p className="text-sm">No sessions available</p>
                <p className="text-xs mt-1">Start a sandbox session first</p>
              </div>
            ) : sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleSessionToggle(session.sessionId)}
                className={cn(
                  'p-4 rounded-lg border cursor-pointer transition-colors',
                  selectedComparisonSessions.includes(session.sessionId)
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{session.simulatorName}</p>
                    <p className="text-xs text-slate-500 font-mono">{session.sessionId.slice(0, 12)}...</p>
                  </div>
                  {selectedComparisonSessions.includes(session.sessionId) && (
                    <CheckCircle className="w-5 h-5 text-amber-500" />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button variant="outline" onClick={() => setShowCompareModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCompareSessions}
              disabled={selectedComparisonSessions.length !== 2 || isComparing}
              loading={isComparing}
              leftIcon={<GitCompare className="w-4 h-4" />}
            >
              Compare ({selectedComparisonSessions.length}/2)
            </Button>
          </div>
        </div>
      </Modal>

      {reportError && (
        <div className="fixed bottom-4 right-4 p-4 bg-red-500/90 text-white rounded-lg shadow-lg flex items-center gap-3 z-50">
          <AlertCircle className="w-5 h-5" />
          <span>{reportError}</span>
          <button onClick={() => clearReport()} className="ml-2 hover:bg-red-600 rounded p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      </>
      ) : analysisMode === 'document' ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <DocumentAnalysisView />
        </motion.div>
      ) : analysisMode === 'url' ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <UrlAnalysisView />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {threatIntelSummary && (
            <ThreatSummaryBar summary={threatIntelSummary} />
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Threat Analyses</h2>
            <button
              onClick={() => loadHistory()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <RefreshCw className={cn('w-4 h-4', threatIntelLoading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {threatIntelLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
          ) : analysisHistory.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {analysisHistory.map((item) => (
                <AnalysisResultCard
                  key={item.id}
                  analysis={item}
                  onClick={() => {
                    loadThreatAnalysis(item.id);
                    setAnalysisMode(item.type === 'url' ? 'url' : 'document');
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <LayoutDashboard className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">Threat Intelligence Workspace</p>
              <p className="text-sm text-slate-500 mb-6">Run document or URL analyses to see results here</p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setAnalysisMode('document')}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 text-sm font-medium"
                >
                  <FileSearch className="w-4 h-4" />
                  Analyze Document
                </button>
                <button
                  onClick={() => setAnalysisMode('url')}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  <Globe className="w-4 h-4" />
                  Analyze URL
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default AIAnalysisPage;


