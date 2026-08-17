/**
 * Threat Intelligence Page
 * SOC-style threat intelligence with force-directed link-analysis graph
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Network, Fingerprint, RefreshCw, Link2, Database, FileSearch } from 'lucide-react';
import api from '../services/api';
import { cn } from '../design-system';

// --- Types ---
interface GraphNode {
  id: string;
  label: string;
  type: string;
  severity: number; // 0-100
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphNodeData {
  id: string;
  type: string;
  label: string;
  metadata?: { severity?: string; threatScore?: number };
}

interface GraphEdgeData {
  source: string;
  target: string;
  relationship: string;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

interface IOC {
  iocId: string;
  type: string;
  value: string;
  severity: string;
  threatScore: number;
  createdAt: string;
  linkedInvestigations?: string[];
  linkedEvidence?: string[];
  source?: string;
  confidence?: number;
  isDerived?: boolean;
  investigationId?: string;
}

interface AnalysisIndicator {
  type: string;
  value: string;
}

interface AnalysisHistoryItem {
  analysisId: string;
  analysisType: string;
  sourceType: string;
  sourceName: string;
  threatScore: number;
  threatLevel: string;
  confidence: number;
  predictedThreat: string;
  indicators?: AnalysisIndicator[];
  iocCount?: number;
  analysisTimestamp?: string;
  investigationId?: string;
}

// --- Force-Directed Graph Canvas ---
function ThreatMapCanvas({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<GraphNode[]>([]);

  useEffect(() => {
    nodesRef.current = nodes.map(n => ({ ...n }));
  }, [nodes]);

  const simulate = useCallback(() => {
    const ns = nodesRef.current;
    if (!ns.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    // Force simulation step
    for (let i = 0; i < ns.length; i++) {
      let fx = 0, fy = 0;
      // Repulsion between all nodes
      for (let j = 0; j < ns.length; j++) {
        if (i === j) continue;
        const dx = ns[i].x - ns[j].x;
        const dy = ns[i].y - ns[j].y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = 800 / (dist * dist);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }
      // Attraction via edges
      for (const edge of edges) {
        let other: GraphNode | undefined;
        if (edge.source === ns[i].id) other = ns.find(n => n.id === edge.target);
        if (edge.target === ns[i].id) other = ns.find(n => n.id === edge.source);
        if (other) {
          const dx = other.x - ns[i].x;
          const dy = other.y - ns[i].y;
          fx += dx * 0.01;
          fy += dy * 0.01;
        }
      }
      // Center gravity
      fx += (cx - ns[i].x) * 0.001;
      fy += (cy - ns[i].y) * 0.001;
      // Apply velocity
      ns[i].vx = (ns[i].vx + fx) * 0.85;
      ns[i].vy = (ns[i].vy + fy) * 0.85;
      ns[i].x += ns[i].vx;
      ns[i].y += ns[i].vy;
      // Bounds
      ns[i].x = Math.max(30, Math.min(W - 30, ns[i].x));
      ns[i].y = Math.max(30, Math.min(H - 30, ns[i].y));
    }

    // Draw
    ctx.clearRect(0, 0, W, H);

    // Edges
    ctx.lineWidth = 1;
    for (const edge of edges) {
      const s = ns.find(n => n.id === edge.source);
      const t = ns.find(n => n.id === edge.target);
      if (!s || !t) continue;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = `rgba(146,120,64,${0.12 + edge.weight * 0.25})`;
      ctx.stroke();
    }

    // Nodes
    const time = Date.now() * 0.003;
    for (const node of ns) {
      const radius = 6 + (node.severity / 100) * 10;
      const pulse = 1 + Math.sin(time + node.severity) * 0.15;
      const r = radius * pulse;

      // Glow
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 2);
      const color = node.severity >= 70 ? '225,29,72' : node.severity >= 40 ? '217,119,6' : '2,132,199';
      gradient.addColorStop(0, `rgba(${color},0.45)`);
      gradient.addColorStop(1, `rgba(${color},0)`);
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color},0.9)`;
      ctx.fill();

      // Label
      ctx.fillStyle = '#44403c';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(node.label.slice(0, 16), node.x, node.y + r + 12);
    }

    animRef.current = requestAnimationFrame(simulate);
  }, [edges]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    }
    animRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(animRef.current);
  }, [simulate]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-[500px] rounded-lg border border-[var(--border-subtle)] bg-white/80 backdrop-blur"
      style={{ imageRendering: 'auto' }}
    />
  );
}

// --- Main Page ---
const DOT_GRID_URL = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoNDEsMzcsMzYsMC4wOCkiLz48L3N2Zz4=";

export const ThreatIntelligencePage: React.FC = () => {
  const [iocs, setIocs] = useState<IOC[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [investigationMap, setInvestigationMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setRefreshing(true);
    try {
      const [iocsRes, graphRes, historyRes, invRes] = await Promise.all([
        api.get<{ iocs: IOC[] }>('/threat/iocs?limit=50'),
        api.get<{ nodes: GraphNodeData[]; edges: GraphEdgeData[] }>('/threat/graph'),
        api.get<AnalysisHistoryItem[] | { items?: AnalysisHistoryItem[]; data?: AnalysisHistoryItem[] }>('/analysis/history?limit=100'),
        api.getInvestigations({ page: 1, limit: 100 }),
      ]);
      const fetchedIocs = (iocsRes.success && iocsRes.data?.iocs ? iocsRes.data.iocs : []).map((ioc) => ({ ...ioc, isDerived: false }));
      const historyPayload = historyRes.success ? historyRes.data : null;
      const historyItems: AnalysisHistoryItem[] = Array.isArray(historyPayload)
        ? (historyPayload as AnalysisHistoryItem[])
        : (historyPayload?.items || historyPayload?.data || []);

      const invMap = new Map<string, string>();
      for (const inv of invRes.success && invRes.data ? invRes.data : []) {
        const invAny = inv as any;
        if (inv.id) invMap.set(inv.id, invAny.caseNumber || invAny.title || inv.id);
      }
      setInvestigationMap(invMap);

      const derived = deriveFromAnalyses(historyItems);
      const mergedIocs = mergeIocs(fetchedIocs, derived.iocs);
      setIocs(mergedIocs);
      buildGraph(
        mergedIocs,
        graphRes.success && graphRes.data ? graphRes.data : { nodes: [], edges: [] },
        derived.nodes,
        derived.edges
      );
    } catch { /* empty state */ }
    setLoading(false);
    setRefreshing(false);
  };

  const severityToScore: Record<string, number> = {
    critical: 90,
    high: 70,
    medium: 45,
    low: 20,
    info: 10,
  };

  const severityFromLevel = (level: string): string => {
    const l = (level || '').toLowerCase();
    if (l === 'critical' || l === 'malicious') return 'critical';
    if (l === 'high') return 'high';
    if (l === 'medium' || l === 'suspicious') return 'medium';
    if (l === 'low') return 'low';
    return 'info';
  };

  const scoreFromLevel = (level: string): number => severityToScore[severityFromLevel(level)] ?? 10;

  // Derive IOCs + graph nodes from document/URL analysis history.
  const deriveFromAnalyses = (items: AnalysisHistoryItem[]) => {
    const iocs: IOC[] = [];
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const seenIocs = new Set<string>();
    const seenSources = new Set<string>();
    const center = { x: 400, y: 250 };

    items.forEach((item, i) => {
      const level = severityFromLevel(item.threatLevel);
      const sourceScore = item.threatScore && item.threatScore > 0 ? item.threatScore : scoreFromLevel(item.threatLevel);
      const sourceId = `src-${item.analysisId}`;
      const sourceName = item.sourceName || item.sourceType || item.analysisId.slice(0, 8);
      if (!seenSources.has(sourceId)) {
        seenSources.add(sourceId);
        nodes.push({
          id: sourceId,
          label: sourceName,
          type: 'source',
          severity: sourceScore,
          x: center.x + Math.cos((i / Math.max(items.length, 1)) * Math.PI * 2) * 90,
          y: center.y + Math.sin((i / Math.max(items.length, 1)) * Math.PI * 2) * 90,
          vx: 0,
          vy: 0,
        });
      }

      (item.indicators || []).forEach((ind) => {
        const key = `${ind.type}:${ind.value}`;
        if (!seenIocs.has(key)) {
          seenIocs.add(key);
          const score = sourceScore;
          const ioc: IOC = {
            iocId: `derived-${key}`,
            type: ind.type,
            value: ind.value,
            severity: level,
            threatScore: score,
            createdAt: item.analysisTimestamp || new Date().toISOString(),
            source: item.sourceType || 'analysis',
            isDerived: true,
            investigationId: item.investigationId,
            linkedInvestigations: item.investigationId ? [item.investigationId] : [],
          };
          iocs.push(ioc);
          nodes.push({
            id: key,
            label: ind.value,
            type: ind.type,
            severity: score,
            x: center.x + Math.cos(seenIocs.size * 2.4) * 150,
            y: center.y + Math.sin(seenIocs.size * 2.4) * 120,
            vx: 0,
            vy: 0,
          });
        }
        if (!edges.find(e => (e.source === sourceId && e.target === key) || (e.source === key && e.target === sourceId))) {
          edges.push({ source: sourceId, target: key, weight: 0.5 });
        }
      });
    });

    return { iocs, nodes, edges };
  };

  const mergeIocs = (serverIocs: IOC[], derivedIocs: IOC[]) => {
    const seen = new Set(serverIocs.map(i => `${i.type}:${i.value}`));
    const merged = [...serverIocs];
    for (const ioc of derivedIocs) {
      if (!seen.has(`${ioc.type}:${ioc.value}`)) merged.push(ioc);
    }
    return merged;
  };

  const addEdge = (edges: GraphEdge[], source: string, target: string) => {
    if (edges.find(e => (e.source === source && e.target === target) || (e.source === target && e.target === source))) {
      return;
    }
    edges.push({ source, target, weight: 0.5 });
  };

  const buildGraph = (
    data: IOC[],
    graph: { nodes: GraphNodeData[]; edges: GraphEdgeData[] },
    derivedNodes: GraphNode[] = [],
    derivedEdges: GraphEdge[] = []
  ) => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const center = { x: 400, y: 250 };

    graph.nodes.forEach((n, i) => {
      const angle = (i / Math.max(graph.nodes.length, 1)) * Math.PI * 2;
      const r = 110 + (i % 4) * 40;
      nodes.push({
        id: n.id,
        label: n.label || n.id,
        type: n.type,
        severity: n.metadata?.threatScore ?? severityToScore[n.metadata?.severity ?? ''] ?? 0,
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      });
    });

    // Server-built edges: ThreatCorrelation relationships
    graph.edges.forEach((e) => {
      if (nodes.some(n => n.id === e.source) && nodes.some(n => n.id === e.target)) {
        addEdge(edges, e.source, e.target);
      }
    });

    // Client-side supplement: link IOCs that share investigations
    data.forEach((ioc) => {
      if (ioc.linkedInvestigations) {
        for (const other of data) {
          if (other.iocId === ioc.iocId) continue;
          if (other.linkedInvestigations?.some(inv => ioc.linkedInvestigations?.includes(inv))) {
            addEdge(edges, ioc.iocId, other.iocId);
          }
        }
      }
    });

    // Derived nodes/edges from analysis history
    const known = new Set(nodes.map(n => n.id));
    for (const n of derivedNodes) {
      if (!known.has(n.id)) {
        known.add(n.id);
        nodes.push(n);
      }
    }
    for (const e of derivedEdges) {
      if (known.has(e.source) && known.has(e.target)) addEdge(edges, e.source, e.target);
    }

    setGraphNodes(nodes);
    setGraphEdges(edges);
  };

  const getSeverityColor = (severity: string) => {
    const map: Record<string, string> = {
      critical: 'text-red-700 bg-red-50 border-red-200',
      high: 'text-orange-700 bg-orange-50 border-orange-200',
      medium: 'text-amber-700 bg-amber-50 border-amber-200',
      low: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      info: 'text-sky-700 bg-sky-50 border-sky-200',
    };
    return map[severity] || 'text-[var(--text-secondary)] bg-[var(--surface-container)] border-[var(--border-default)] ';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 70) return 'bg-red-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-sky-500';
  };

  const criticalCount = iocs.filter(i => i.severity === 'critical').length;
  const highCount = iocs.filter(i => i.severity === 'high').length;
  const mediumCount = iocs.filter(i => i.severity === 'medium').length;
  const serverCount = iocs.filter(i => !i.isDerived).length;
  const derivedCount = iocs.filter(i => i.isDerived).length;

  const investigationName = (id?: string): string | null => {
    if (!id) return null;
    return investigationMap.get(id) || `${id.slice(0, 8)}…`;
  };

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="eyebrow">Intelligence · IOC Correlation</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-[var(--text-primary)]  font-display tracking-tight">
              Threat Intelligence
            </h1>
            <span className="stamp">LINK-ANALYSIS</span>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[var(--border-default)] rounded-lg hover:bg-[var(--surface-container-lowest)] disabled:opacity-60"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)] ">
            Link-analysis graph · IOC correlation · Real-time threat mapping
          </p>
        </motion.div>

        {/* Posture chips */}
        {iocs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex flex-wrap items-center gap-2 mb-5"
          >
            {[
              { label: `${iocs.length} indicators`, cls: 'text-[var(--text-secondary)] bg-[var(--surface-container-low)] border-[var(--border-subtle)]' },
              { label: `${serverCount} server · ${derivedCount} derived`, cls: 'text-[var(--text-secondary)] bg-[var(--surface-container-low)] border-[var(--border-subtle)]' },
              { label: `${criticalCount} critical`, cls: 'text-red-700 bg-red-50 border-red-200' },
              { label: `${highCount} high`, cls: 'text-orange-700 bg-orange-50 border-orange-200' },
              { label: `${mediumCount} medium`, cls: 'text-amber-700 bg-amber-50 border-amber-200' },
              { label: `${graphNodes.length} nodes · ${graphEdges.length} links`, cls: 'text-[var(--text-secondary)] bg-[var(--surface-container-low)] border-[var(--border-subtle)]' },
            ].map((chip) => (
              <span key={chip.label} className={`px-2.5 py-1 text-xs font-mono rounded-full border ${chip.cls}`}>
                {chip.label}
              </span>
            ))}
          </motion.div>
        )}

        {/* Force-Directed Graph */}
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="mb-6">
          <div className="relative rounded-xl border border-[var(--border-subtle)] overflow-hidden bg-gradient-to-br from-[var(--surface-container-lowest)] via-white to-[var(--surface-container-low)] p-1">
            <div className="absolute inset-0" style={{ backgroundImage: `url('${DOT_GRID_URL}')` }} />
            {loading ? (
              <div className="flex items-center justify-center h-[500px]">
                <div className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : graphNodes.length > 0 ? (
              <ThreatMapCanvas nodes={graphNodes} edges={graphEdges} />
            ) : (
              <div className="relative flex flex-col items-center justify-center h-[500px] text-[var(--text-secondary)] ">
                <div className="w-14 h-14 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-center mb-4">
                  <Network className="w-6 h-6 text-[var(--text-tertiary)]" />
                </div>
                <p className="text-lg font-mono text-[var(--text-primary)]">No threat data available</p>
                <p className="text-sm mt-1 max-w-sm text-center">
                  Indicators will appear here after sandbox analysis or document/URL analysis
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* IOC Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="rounded-xl border border-[var(--border-subtle)]  bg-white  backdrop-blur overflow-hidden">
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]  font-mono">Active IOCs</h2>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  Server-tracked indicators plus IOCs derived from analysis history
                </p>
              </div>
              <span className="px-2.5 py-1 text-xs font-mono rounded-full border border-[var(--border-subtle)] bg-[var(--surface-container-low)] text-[var(--text-secondary)]">
                {iocs.length} tracked
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--surface-container-lowest)] ">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-mono text-[var(--text-secondary)]  uppercase">Indicator</th>
                    <th className="px-4 py-3 text-left text-xs font-mono text-[var(--text-secondary)]  uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-mono text-[var(--text-secondary)]  uppercase">Severity</th>
                    <th className="px-4 py-3 text-left text-xs font-mono text-[var(--text-secondary)]  uppercase">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-mono text-[var(--text-secondary)]  uppercase">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-mono text-[var(--text-secondary)]  uppercase">Investigation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {iocs.slice(0, 20).map((ioc, i) => (
                    <motion.tr
                      key={ioc.iocId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-[var(--surface-container-low)] "
                    >
                      <td className="px-4 py-3 font-mono text-sm text-[var(--text-secondary)] break-all">{ioc.value}</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]  capitalize">
                        <span className="inline-flex items-center gap-1.5">
                          <Fingerprint className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                          {ioc.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-mono rounded border ${getSeverityColor(ioc.severity)}`}>{ioc.severity}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[var(--surface-container-low)]  rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${getScoreBarColor(ioc.threatScore)}`} style={{ width: `${Math.max(4, Math.min(100, ioc.threatScore))}%` }} />
                          </div>
                          <span className="text-xs font-mono text-[var(--text-secondary)] ">{ioc.threatScore}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded border uppercase',
                            ioc.isDerived
                              ? 'text-violet-700 bg-violet-50 border-violet-200'
                              : 'text-sky-700 bg-sky-50 border-sky-200'
                          )}>
                            {ioc.isDerived ? <FileSearch className="w-2.5 h-2.5" /> : <Database className="w-2.5 h-2.5" />}
                            {ioc.isDerived ? 'Derived' : 'Server'}
                          </span>
                          {ioc.source && (
                            <span className="text-xs text-[var(--text-tertiary)]">{ioc.source.replace(/_/g, ' ')}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const invIds = [...new Set([
                            ...(ioc.isDerived ? (ioc.investigationId ? [ioc.investigationId] : []) : []),
                            ...(ioc.linkedInvestigations || []),
                          ])];
                          if (invIds.length === 0) {
                            return <span className="text-xs text-[var(--text-tertiary)]">—</span>;
                          }
                          return (
                            <div className="flex items-center gap-1 flex-wrap">
                              {invIds.slice(0, 2).map((id) => (
                                <span
                                  key={id}
                                  title={id}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded border border-[var(--border-default)] bg-[var(--surface-container-low)] text-[var(--text-secondary)]"
                                >
                                  <Link2 className="w-2.5 h-2.5 text-[var(--text-tertiary)]" />
                                  {investigationName(id)}
                                </span>
                              ))}
                              {invIds.length > 2 && (
                                <span className="text-[10px] font-mono text-[var(--text-tertiary)]">+{invIds.length - 2}</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {iocs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <ShieldAlert className="w-8 h-8 text-[var(--text-tertiary)] mb-3" />
                  <p className="text-sm font-mono text-[var(--text-secondary)]">No indicators tracked yet</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xs">
                    Run a sandbox session or analyze a document/URL to extract indicators of compromise
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ThreatIntelligencePage;
