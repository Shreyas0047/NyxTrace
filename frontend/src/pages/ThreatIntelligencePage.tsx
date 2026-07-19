/**
 * Threat Intelligence Page
 * SOC-style threat intelligence with force-directed link-analysis graph
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';

// --- Types ---
interface GraphNode {
  id: string;
  label: string;
  type: 'ip' | 'hash' | 'investigation' | 'domain';
  severity: number; // 0-100
  x: number;
  y: number;
  vx: number;
  vy: number;
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
      ctx.strokeStyle = `rgba(34,211,238,${0.15 + edge.weight * 0.3})`;
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
      const color = node.severity >= 70 ? '239,68,68' : node.severity >= 40 ? '245,158,11' : '34,211,238';
      gradient.addColorStop(0, `rgba(${color},0.8)`);
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
      ctx.fillStyle = '#e2e8f0';
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
      className="w-full h-[500px] rounded-lg border border-slate-200/50 bg-white/80 backdrop-blur"
      style={{ imageRendering: 'auto' }}
    />
  );
}

// --- Main Page ---
export const ThreatIntelligencePage: React.FC = () => {
  const [iocs, setIocs] = useState<IOC[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ iocs: IOC[] }>('/threat/iocs?limit=50');
      if (res.success && res.data?.iocs) {
        const fetchedIocs = res.data.iocs;
        setIocs(fetchedIocs);
        buildGraph(fetchedIocs);
      }
    } catch { /* empty state */ }
    setLoading(false);
  };

  const buildGraph = (data: IOC[]) => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const center = { x: 400, y: 250 };

    data.forEach((ioc, i) => {
      const angle = (i / data.length) * Math.PI * 2;
      const r = 120 + Math.random() * 80;
      nodes.push({
        id: ioc.iocId,
        label: ioc.value,
        type: ioc.type as GraphNode['type'],
        severity: ioc.threatScore,
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r,
        vx: 0, vy: 0,
      });

      // Link IOCs that share investigations
      if (ioc.linkedInvestigations) {
        for (const other of data) {
          if (other.iocId === ioc.iocId) continue;
          if (other.linkedInvestigations?.some(inv => ioc.linkedInvestigations?.includes(inv))) {
            if (!edges.find(e => (e.source === ioc.iocId && e.target === other.iocId) || (e.source === other.iocId && e.target === ioc.iocId))) {
              edges.push({ source: ioc.iocId, target: other.iocId, weight: 0.5 });
            }
          }
        }
      }
    });

    setGraphNodes(nodes);
    setGraphEdges(edges);
  };

  const getSeverityColor = (severity: string) => {
    const map: Record<string, string> = {
      critical: 'text-red-400 bg-red-500/10 border-red-500/30',
      high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
      medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
      low: 'text-green-400 bg-green-500/10 border-green-500/30',
    };
    return map[severity] || 'text-slate-500 bg-slate-500/10 border-slate-500/30';
  };

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-mono tracking-tight">
            Threat Intelligence
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Link-analysis graph · IOC correlation · Real-time threat mapping
          </p>
        </motion.div>

        {/* Force-Directed Graph */}
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="mb-6">
          <div className="relative rounded-xl border border-slate-200/50 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800/50 to-slate-900 p-1">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjAuNSIgZmlsbD0icmdiYSgxNDgsMTYzLDE4NCwwLjA1KSIvPjwvc3ZnPg==')] opacity-50" />
            {loading ? (
              <div className="flex items-center justify-center h-[500px]">
                <div className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : graphNodes.length > 0 ? (
              <ThreatMapCanvas nodes={graphNodes} edges={graphEdges} />
            ) : (
              <div className="flex flex-col items-center justify-center h-[500px] text-slate-500 dark:text-slate-400">
                <p className="text-lg font-mono">No threat data available</p>
                <p className="text-sm mt-1">IOCs will appear here after sandbox analysis</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* IOC Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-800/80 backdrop-blur overflow-hidden">
            <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white font-mono">Active IOCs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-mono text-slate-500 dark:text-slate-400 uppercase">Indicator</th>
                    <th className="px-4 py-3 text-left text-xs font-mono text-slate-500 dark:text-slate-400 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-mono text-slate-500 dark:text-slate-400 uppercase">Severity</th>
                    <th className="px-4 py-3 text-left text-xs font-mono text-slate-500 dark:text-slate-400 uppercase">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {iocs.slice(0, 20).map((ioc, i) => (
                    <motion.tr
                      key={ioc.iocId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-slate-100/20 dark:hover:bg-slate-700/20"
                    >
                      <td className="px-4 py-3 font-mono text-sm text-slate-400">{ioc.value}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 capitalize">{ioc.type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-mono rounded border ${getSeverityColor(ioc.severity)}`}>{ioc.severity}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${ioc.threatScore >= 70 ? 'bg-red-500' : ioc.threatScore >= 40 ? 'bg-yellow-500' : 'bg-cyan-500'}`} style={{ width: `${ioc.threatScore}%` }} />
                          </div>
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{ioc.threatScore}</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ThreatIntelligencePage;

