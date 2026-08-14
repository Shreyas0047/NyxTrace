import { useEffect, useRef, useState } from 'react';
import { Radio, RefreshCw } from 'lucide-react';
import { useRealtimeStore } from '../../stores/realtimeStore';
import { cn } from '../../design-system';
import api from '../../services/api';
import { config } from '../../config';

export function ConnectionStatus() {
  const { isConnected, connect, disconnect, socketId, telemetryBuffer, liveAlerts } = useRealtimeStore();
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
    live: {
      dot: 'text-emerald-600',
      label: 'Live',
      labelColor: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      ws: 'LIVE',
      api: 'OK',
      readoutColor: 'text-emerald-800/80',
    },
    connected: {
      dot: 'text-emerald-600',
      label: 'Connecting',
      labelColor: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      ws: 'SYNC',
      api: 'OK',
      readoutColor: 'text-amber-800/80',
    },
    connecting: {
      dot: 'text-[#6c6862]',
      label: 'Connecting',
      labelColor: 'text-[var(--text-secondary)]',
      bg: 'bg-[var(--surface-container-low)]',
      border: 'border-[var(--border-subtle)]',
      ws: '…',
      api: 'CHECK',
      readoutColor: 'text-[var(--text-tertiary)]',
    },
    offline: {
      dot: 'text-rose-600',
      label: 'Offline',
      labelColor: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      ws: 'DOWN',
      api: 'DOWN',
      readoutColor: 'text-rose-800/80',
    },
  }[status];

  return (
    <div className="flex items-center gap-2" title={`Socket: ${socketId ?? '—'}`}>
      <div className={cn('flex items-center gap-2 px-2.5 py-1 rounded-md border', styles.bg, styles.border)}>
        <Radio strokeWidth={1.75} className={cn('w-3 h-3', styles.dot, status === 'live' && 'animate-pulse')} />
        <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-[0.12em]', styles.labelColor)}>
          {styles.label}
        </span>
        <span className="h-3 w-px bg-[var(--border-default)]" aria-hidden />
        <span className={cn('text-[10px] font-mono tracking-[0.05em] whitespace-nowrap', styles.readoutColor)}>
          WS: {styles.ws} · API: {styles.api}
          {status === 'live' && ` · EVT: ${telemetryBuffer.length}`}
          {status === 'live' && ` · ALR: ${liveAlerts.length}`}
        </span>
      </div>

      {status === 'offline' && (
        <button
          onClick={handleReconnect}
          className="p-1 rounded-md hover:bg-[var(--surface-container)] transition-colors"
          title="Reconnect"
        >
          <RefreshCw strokeWidth={1.5} className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
        </button>
      )}
    </div>
  );
}

export default ConnectionStatus;
