import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle, AlertTriangle, Clock, Search, ExternalLink } from 'lucide-react';
import api from '../services/api';
import type { TamperAlert } from '../types/blockchain';

interface IntegrityStats {
  totalEvidence: number;
  verified: number;
  modified: number;
  pending: number;
  tamperAlerts: number;
}

interface CustodyEvent {
  timestamp: string;
  action: string;
  actor: string;
  details?: string;
  txHash?: string;
  blockNumber?: number;
  verified?: boolean;
}

export function ChainOfCustodyPage() {
  const [stats, setStats] = useState<IntegrityStats | null>(null);
  const [alerts, setAlerts] = useState<TamperAlert[]>([]);
  const [custodyChain, setCustodyChain] = useState<CustodyEvent[]>([]);
  const [evidenceIdInput, setEvidenceIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<number | null>(null);

  useEffect(() => {
    fetchStats();
    fetchAlerts();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get<{ stats: IntegrityStats }>('/custody/integrity-stats');
      if (res.success && res.data) setStats(res.data.stats);
    } catch { /* non-critical */ }
  };

  const fetchAlerts = async () => {
    try {
      const res = await api.getTamperAlerts(true);
      if (res.success && res.data) setAlerts(res.data.alerts || []);
    } catch { /* non-critical */ }
  };

  const lookupCustody = async () => {
    if (!evidenceIdInput.trim()) return;
    setLoading(true);
    setError(null);
    setCustodyChain([]);
    try {
      const res = await api.get<{ chain: CustodyEvent[] }>(`/custody/chain/${evidenceIdInput.trim()}`);
      if (res.success && res.data) {
        setCustodyChain(res.data.chain || []);
      } else {
        setError('No custody record found.');
      }
    } catch {
      setError('Failed to fetch custody chain.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full">
      <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-mono tracking-tight flex items-center gap-3">
            <Shield className="w-8 h-8 text-cyan-400" />
            Chain of Custody
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Immutable evidence lineage · Blockchain verification · Tamper detection</p>
        </motion.div>

        {stats && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total Evidence', value: stats.totalEvidence, icon: Shield, color: 'slate' },
              { label: 'Verified', value: stats.verified, icon: CheckCircle, color: 'green' },
              { label: 'Modified', value: stats.modified, icon: AlertTriangle, color: 'amber' },
              { label: 'Pending', value: stats.pending, icon: Clock, color: 'blue' },
              { label: 'Tamper Alerts', value: stats.tamperAlerts, icon: AlertTriangle, color: 'red' },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.04 }}
                className={`rounded-lg border border-slate-200/50 dark:border-slate-700/50 bg-slate-50/40 dark:bg-slate-800/40 backdrop-blur p-3`}
              >
                <card.icon className={`w-4 h-4 text-${card.color}-400 mb-1`} />
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{card.value}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">{card.label}</div>
              </motion.div>
            ))}
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-800/80 backdrop-blur p-4 mb-6">
          <h2 className="text-sm font-mono text-cyan-400 uppercase tracking-wider mb-3">Evidence Custody Lookup</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={evidenceIdInput}
              onChange={e => setEvidenceIdInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookupCustody()}
              placeholder="Enter evidence ID..."
              className="flex-1 px-3 py-2 rounded-lg bg-white/80 dark:bg-slate-700/80 border border-slate-600/50 text-slate-900 dark:text-white text-sm font-mono placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
            <button onClick={lookupCustody} disabled={loading} className="px-4 py-2 bg-cyan-600/80 hover:bg-cyan-500 text-white text-sm font-mono rounded-lg flex items-center gap-2 transition-all disabled:opacity-50">
              <Search className="w-4 h-4" /> Trace
            </button>
          </div>
          {error && <p className="text-red-400 text-xs font-mono mt-2">{error}</p>}
        </motion.div>

        {custodyChain.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="relative mb-6">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/60 via-cyan-500/20 to-transparent" />

            <div className="space-y-0">
              {custodyChain.map((event, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className="relative pl-14 py-3"
                  onMouseEnter={() => setHoveredEvent(i)}
                  onMouseLeave={() => setHoveredEvent(null)}
                >
                  <div className="absolute left-[18px] top-4 w-3 h-3">
                    <div className={`absolute inset-0 rounded-full ${event.verified ? 'bg-green-500' : 'bg-cyan-500'}`} />
                    <div className={`absolute inset-0 rounded-full ${event.verified ? 'bg-green-500' : 'bg-cyan-500'} animate-ping opacity-30`} />
                  </div>

                  <div className={`rounded-lg border transition-all duration-200 p-3 ${
                    hoveredEvent === i
                      ? 'border-cyan-500/50 bg-slate-50/60 dark:bg-slate-700/60 shadow-[0_0_20px_rgba(34,211,238,0.08)]'
                      : 'border-slate-200/30 dark:border-slate-700/30 bg-white dark:bg-slate-800/80'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{new Date(event.timestamp).toLocaleString()}</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{event.action}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">by <span className="text-cyan-400">{event.actor}</span></span>
                      </div>

                      {event.verified && (
                        <div className="relative group">
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] font-mono cursor-pointer">
                            <CheckCircle className="w-3 h-3" />
                            <span>VERIFIED</span>
                          </div>

                          <AnimatePresence>
                            {hoveredEvent === i && event.txHash && (
                              <motion.div
                                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                className="absolute right-0 top-8 z-10 w-72 rounded-lg border border-green-500/30 bg-white/95 dark:bg-slate-800/95 backdrop-blur p-3 shadow-xl"
                              >
                                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-1">Transaction Hash</div>
                                <div className="text-[11px] font-mono text-green-400 break-all">{event.txHash}</div>
                                {event.blockNumber && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Block:</span>
                                    <span className="text-[11px] font-mono text-cyan-400">#{event.blockNumber}</span>
                                  </div>
                                )}
                                <a href="#" className="mt-2 flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300">
                                  <ExternalLink className="w-3 h-3" /> View on Explorer
                                </a>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                    {event.details && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">{event.details}</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-800/80 backdrop-blur p-4">
            <h2 className="text-sm font-mono text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Active Tamper Alerts
              {alerts.length > 0 && <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 border border-red-500/30 rounded-full">{alerts.length}</span>}
            </h2>
            {alerts.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">✓ No unacknowledged tamper alerts. Evidence integrity intact.</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert, i) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-3 rounded-lg border border-red-500/20 bg-red-500/5"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <div className="flex-1">
                        <span className="text-sm text-red-300 font-medium">{alert.type}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">Evidence: {alert.evidenceId}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{new Date(alert.detectedAt).toLocaleDateString()}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default ChainOfCustodyPage;
