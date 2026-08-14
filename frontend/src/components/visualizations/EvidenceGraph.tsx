/**
 * Evidence Relationship Graph
 * Interactive node-based visualization for forensic evidence relationships
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ZoomIn,
  ZoomOut,
  FileText,
  Cpu,
  Network,
  HardDrive,
  Fingerprint,
  Shield,
  Link2,
  X,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '../../providers/ThemeProvider';
import { cn } from '../../design-system';

interface GraphNode {
  id: string;
  label: string;
  type: 'process' | 'file' | 'network' | 'registry' | 'artifact' | 'threat';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  metadata?: Record<string, string>;
}

interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  type: 'spawns' | 'accesses' | 'connects' | 'modifies' | 'contains' | 'related';
}

interface EvidenceGraphProps {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  title?: string;
}

const nodeTypeIcons = {
  process: Cpu,
  file: FileText,
  network: Network,
  registry: Fingerprint,
  artifact: HardDrive,
  threat: Shield,
};

const nodeTypeColors = {
  process: { bg: 'bg-blue-500', text: 'text-blue-500', ring: 'ring-blue-500/30' },
  file: { bg: 'bg-violet-500', text: 'text-violet-500', ring: 'ring-violet-500/30' },
  network: { bg: 'bg-cyan-500', text: 'text-cyan-600', ring: 'ring-cyan-500/30' },
  registry: { bg: 'bg-amber-500', text: 'text-amber-500', ring: 'ring-amber-500/30' },
  artifact: { bg: 'bg-emerald-500', text: 'text-emerald-500', ring: 'ring-emerald-500/30' },
  threat: { bg: 'bg-red-500', text: 'text-red-500', ring: 'ring-red-500/30' },
};

const severityColors = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

export function EvidenceGraph({
  nodes = [],
  edges = [],
  title = 'Evidence Relationship Graph',
}: EvidenceGraphProps) {
  const { isDark } = useTheme();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [filterType, setFilterType] = useState<string>('all');

  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (filterType !== 'all' && node.type !== filterType) return false;
      if (searchQuery && !node.label.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [nodes, filterType, searchQuery]);

  const getNodePosition = (index: number, total: number, centerX: number, centerY: number, radius: number) => {
    const angle = (2 * Math.PI * index) / total - Math.PI / 2;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  };

  const centerX = 300;
  const centerY = 200;
  const radius = 150;

  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    filteredNodes.forEach((node, index) => {
      positions[node.id] = getNodePosition(index, filteredNodes.length, centerX, centerY, radius);
    });
    return positions;
  }, [filteredNodes]);

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      isDark ? 'bg-[var(--surface-container-low)]  border-[var(--border-subtle)] ' : 'bg-white border-[var(--border-subtle)]'
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-5 py-4 border-b',
        isDark ? 'border-[var(--border-subtle)] ' : 'border-[var(--border-subtle)]'
      )}>
        <div className="flex items-center gap-3">
          <Link2 className={cn('w-5 h-5', isDark ? 'text-[var(--text-secondary)] ' : 'text-[var(--text-secondary)]')} />
          <h3 className={cn(
            'text-base font-semibold',
            isDark ? 'text-[var(--text-primary)] ' : 'text-[var(--text-primary)]'
          )}>
            {title}
          </h3>
          <span className={cn(
            'px-2 py-0.5 text-xs rounded-full',
            isDark ? 'bg-[var(--surface-container-low)]  text-[var(--text-secondary)] ' : 'bg-[var(--surface-container-low)] text-[var(--text-secondary)]'
          )}>
            {filteredNodes.length} nodes
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className={cn(
              'absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4',
              isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)] '
            )} />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'pl-9 pr-3 py-1.5 text-sm rounded-lg w-40',
                'bg-transparent border outline-none',
                isDark
                  ? 'border-[var(--border-default)]  focus:border-blue-500 text-[var(--text-secondary)]  placeholder:text-[var(--text-tertiary)]'
                  : 'border-[var(--border-subtle)] focus:border-blue-500 text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] '
              )}
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg border outline-none',
              isDark
                ? 'bg-[var(--surface-container-low)]  border-[var(--border-default)]  text-[var(--text-secondary)] '
                : 'bg-white border-[var(--border-subtle)] text-[var(--text-secondary)]'
            )}
          >
            <option value="all">All Types</option>
            <option value="process">Process</option>
            <option value="file">File</option>
            <option value="network">Network</option>
            <option value="registry">Registry</option>
            <option value="artifact">Artifact</option>
            <option value="threat">Threat</option>
          </select>

          {/* Zoom Controls */}
          <div className={cn(
            'flex items-center gap-1 p-1 rounded-lg',
            isDark ? 'bg-[var(--surface-container-low)] ' : 'bg-[var(--surface-container-low)]'
          )}>
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              className={cn(
                'p-1.5 rounded transition-colors',
                isDark ? 'hover:bg-slate-600' : 'hover:bg-[var(--surface-container)]'
              )}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className={cn(
              'text-xs font-medium px-2',
              isDark ? 'text-[var(--text-secondary)] ' : 'text-[var(--text-secondary)]'
            )}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
              className={cn(
                'p-1.5 rounded transition-colors',
                isDark ? 'hover:bg-slate-600' : 'hover:bg-[var(--surface-container)]'
              )}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Graph Area */}
      <div className="relative p-5">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Link2 className="w-12 h-12 text-[var(--text-secondary)]  mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">No evidence graph data available</p>
            <p className="text-xs text-[var(--text-secondary)]  mt-1">Evidence relationships will appear after analysis</p>
          </div>
        ) : (
          <div>
          <div className="relative overflow-hidden" style={{ height: 400 }}>
          <svg
            className="absolute inset-0"
            viewBox="0 0 600 400"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
          >
            {/* Edges */}
            {edges.map((edge, index) => {
              const sourcePos = nodePositions[edge.source];
              const targetPos = nodePositions[edge.target];
              if (!sourcePos || !targetPos) return null;

              return (
                <motion.g key={`edge-${index}`}>
                  <line
                    x1={sourcePos.x}
                    y1={sourcePos.y}
                    x2={targetPos.x}
                    y2={targetPos.y}
                    stroke={isDark ? '#475569' : '#cbd5e1'}
                    strokeWidth={1.5}
                    strokeDasharray={edge.type === 'related' ? '4,4' : 'none'}
                    className="opacity-60"
                  />
                  {edge.label && (
                    <text
                      x={(sourcePos.x + targetPos.x) / 2}
                      y={(sourcePos.y + targetPos.y) / 2 - 8}
                      className="text-[10px] fill-current"
                      fill={isDark ? '#64748b' : '#94a3b8'}
                    >
                      {edge.label}
                    </text>
                  )}
                </motion.g>
              );
            })}

            {/* Nodes */}
            {filteredNodes.map((node, index) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;
              const colors = nodeTypeColors[node.type];
              const Icon = nodeTypeIcons[node.type];

              return (
                <motion.g
                  key={node.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="cursor-pointer"
                  onClick={() => setSelectedNode(node)}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={28}
                    className={cn(
                      'transition-all duration-200',
                      colors.bg,
                      'fill-opacity-20',
                      'stroke-2',
                      colors.ring
                    )}
                    style={{ fill: colors.bg.replace('bg-', ''), fillOpacity: 0.2 }}
                  />
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={22}
                    className={cn(colors.bg, 'fill-opacity-30')}
                    style={{ fill: colors.bg.replace('bg-', ''), fillOpacity: 0.3 }}
                  />
                  <foreignObject x={pos.x - 12} y={pos.y - 12} width={24} height={24}>
                    <Icon className={cn('w-5 h-5', colors.text)} />
                  </foreignObject>

                  {/* Severity indicator */}
                  {node.severity && (
                    <circle
                      cx={pos.x + 20}
                      cy={pos.y - 20}
                      r={6}
                      className={severityColors[node.severity]}
                    />
                  )}

                  {/* Label */}
                  <text
                    x={pos.x}
                    y={pos.y + 42}
                    textAnchor="middle"
                    className="text-xs font-medium"
                    fill={isDark ? '#cbd5e1' : '#475569'}
                  >
                    {node.label.length > 15 ? node.label.slice(0, 15) + '...' : node.label}
                  </text>
                </motion.g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className={cn(
          'flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t',
          isDark ? 'border-[var(--border-subtle)] ' : 'border-[var(--border-subtle)]'
        )}>
          {Object.entries(nodeTypeColors).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-2">
              <div className={cn('w-3 h-3 rounded-full', colors.bg)} />
              <span className={cn(
                'text-xs capitalize',
                isDark ? 'text-[var(--text-secondary)] ' : 'text-[var(--text-secondary)]'
              )}>
                {type}
              </span>
            </div>
          ))}
        </div>
        </div>
        )}
      </div>

      {/* Node Detail Panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className={cn(
              'absolute right-0 top-16 bottom-0 w-80 p-5 overflow-y-auto',
              isDark ? 'bg-slate-900 border-l border-[var(--border-subtle)] ' : 'bg-white border-l border-[var(--border-subtle)]'
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className={cn(
                'text-lg font-semibold',
                isDark ? 'text-[var(--text-primary)] ' : 'text-[var(--text-primary)]'
              )}>
                Node Details
              </h4>
              <button
                onClick={() => setSelectedNode(null)}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  isDark ? 'hover:bg-[var(--surface-container)] ' : 'hover:bg-[var(--surface-container-low)]'
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className={cn(
                'flex items-center gap-3 p-3 rounded-xl',
                isDark ? 'bg-[var(--surface-container-low)] ' : 'bg-[var(--surface-container-lowest)]'
              )}>
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  nodeTypeColors[selectedNode.type].bg,
                  'bg-opacity-20'
                )}>
                  {(() => {
                    const Icon = nodeTypeIcons[selectedNode.type];
                    return <Icon className={cn('w-5 h-5', nodeTypeColors[selectedNode.type].text)} />;
                  })()}
                </div>
                <div>
                  <p className={cn(
                    'font-semibold',
                    isDark ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                  )}>
                    {selectedNode.label}
                  </p>
                  <p className={cn(
                    'text-xs capitalize',
                    isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)] '
                  )}>
                    {selectedNode.type}
                  </p>
                </div>
              </div>

              {selectedNode.severity && (
                <div>
                  <p className={cn(
                    'text-xs font-medium mb-2',
                    isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)] '
                  )}>
                    Severity
                  </p>
                  <span className={cn(
                    'inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg capitalize',
                    severityColors[selectedNode.severity],
                    'text-white'
                  )}>
                    {selectedNode.severity}
                  </span>
                </div>
              )}

              {selectedNode.metadata && (
                <div>
                  <p className={cn(
                    'text-xs font-medium mb-2',
                    isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)] '
                  )}>
                    Metadata
                  </p>
                  <div className={cn(
                    'space-y-2 p-3 rounded-xl',
                    isDark ? 'bg-[var(--surface-container-low)] ' : 'bg-[var(--surface-container-lowest)]'
                  )}>
                    {Object.entries(selectedNode.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className={cn(
                          'text-xs',
                          isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)] '
                        )}>
                          {key}
                        </span>
                        <span className={cn(
                          'text-xs font-mono',
                          isDark ? 'text-[var(--text-secondary)] ' : 'text-[var(--text-secondary)]'
                        )}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className={cn(
                  'text-xs font-medium',
                  isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)] '
                )}>
                  Connected To
                </p>
                {edges
                  .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                  .map((edge, index) => {
                    const connectedId = edge.source === selectedNode.id ? edge.target : edge.source;
                    const connectedNode = nodes.find((n) => n.id === connectedId);
                    if (!connectedNode) return null;

                    return (
                      <button
                        key={index}
                        onClick={() => setSelectedNode(connectedNode)}
                        className={cn(
                          'w-full flex items-center justify-between p-2 rounded-lg',
                          'transition-colors',
                          isDark ? 'hover:bg-[var(--surface-container)] ' : 'hover:bg-[var(--surface-container-lowest)]'
                        )}
                      >
                        <span className={cn(
                          'text-sm',
                          isDark ? 'text-[var(--text-secondary)] ' : 'text-[var(--text-secondary)]'
                        )}>
                          {connectedNode.label}
                        </span>
                        <ChevronRight className={cn(
                          'w-4 h-4',
                          isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)] '
                        )} />
                      </button>
                    );
                  })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default EvidenceGraph;
