import { useEffect, useRef, useState } from 'react';
import { Radio, RefreshCw } from 'lucide-react';
import { useRealtimeStore } from '../../stores/realtimeStore';
import { cn } from '../../design-system';
import api from '../../services/api';
import { config } from '../../config';

export function ConnectionStatus() {
  const { isConnected, connect, disconnect } = useRealtimeStore();
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll backend health every 15s as a fallback
  useEffect(() => {
    let cancelled = false;
    const checkHealth = async () => {
      try {
        const res = await api.get('/operations/health');
        if (!cancelled) setApiHealthy(res.success);
      } catch (err: any) {
        // Backend may return 503 when downstream services are down,
        // but the JSON body still has success:true — backend itself is reachable.
        if (!cancelled) {
          setApiHealthy(err?.response?.data?.success === true);
        }
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, config.polling.connectionHealthMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      disconnect();
    };
  }, [connect, disconnect]);

  const handleReconnect = () => {
    disconnect();
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = setTimeout(() => connect(), 500);
  };

  // Three states:
  // - Live: WS connected (best)
  // - Connected: REST API up, WS reconnecting (acceptable)
  // - Offline: REST API also down (degraded)
  const status = isConnected ? 'live' : apiHealthy ? 'connected' : apiHealthy === false ? 'offline' : 'connecting';

  const styles = {
    live: { dot: 'text-emerald-400', label: 'Live', labelColor: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    connected: { dot: 'text-emerald-400', label: 'Connected', labelColor: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    connecting: { dot: 'text-[#6c6862]', label: 'Connecting', labelColor: 'text-[#a09b93]', bg: 'bg-white/5', border: 'border-white/10' },
    offline: { dot: 'text-rose-400', label: 'Offline', labelColor: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  }[status];

  return (
    <div className="flex items-center gap-2">
      <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-md border', styles.bg, styles.border)}>
        <Radio strokeWidth={1.75} className={cn('w-3 h-3', styles.dot, status === 'live' && 'animate-pulse')} />
        <span className={cn('text-[11px] font-mono font-medium', styles.labelColor)}>{styles.label}</span>
      </div>

      {status === 'offline' && (
        <button
          onClick={handleReconnect}
          className="p-1 rounded-md hover:bg-white/5 transition-colors"
          title="Reconnect"
        >
          <RefreshCw strokeWidth={1.5} className="w-3.5 h-3.5 text-[#a09b93]" />
        </button>
      )}
    </div>
  );
}

export default ConnectionStatus;
