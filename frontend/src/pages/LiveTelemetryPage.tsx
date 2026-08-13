import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Filter,
  Cpu,
  HardDrive,
  Network,
  FileText,
  Shield,
  Pause,
  Play as PlayIcon,
  ArrowDown,
  ArrowUp,
  Trash2,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { PageHeader, PageGrid } from '../layouts/PageContainer';
import { DashboardCard, DashboardStat } from '../components/enterprise/DashboardGrid';
import { useTelemetryStore } from '../stores/telemetryStore';
import { cn } from '../design-system';

const eventTypeColors: Record<string, string> = {
  process: 'bg-blue-500',
  file: 'bg-orange-500',
  registry: 'bg-purple-500',
  network: 'bg-red-500',
  module: 'bg-slate-500',
  behavior: 'bg-amber-500',
  anomaly: 'bg-rose-500',
};

const eventTypeIcons: Record<string, typeof Activity> = {
  process: Cpu,
  file: FileText,
  registry: HardDrive,
  network: Network,
  module: Shield,
  behavior: Activity,
  anomaly: AlertTriangle,
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };

export function LiveTelemetryPage() {
  const telemetry = useTelemetryStore();
  const [typeFilter, setTypeFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  const streamEndRef = useRef<HTMLDivElement>(null);
  const streamContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    telemetry.connect();
    return () => {
      telemetry.disconnect();
    };
  }, []);

  useEffect(() => {
    if (telemetry.autoScroll && streamEndRef.current && streamContainerRef.current) {
      streamContainerRef.current.scrollTop = streamContainerRef.current.scrollHeight;
    }
  }, [telemetry.events, telemetry.autoScroll]);

  const filteredEvents = telemetry.events.filter((event) => {
    const matchesType = typeFilter === 'all' || event.category === typeFilter;
    const matchesSource = sourceFilter === 'all' ||
      (event.data?.source && event.data.source === sourceFilter);
    return matchesType && matchesSource;
  });

  const stats = {
    totalEvents: telemetry.events.length,
    processCount: telemetry.events.filter(e => e.category === 'process').length,
    fileCount: telemetry.events.filter(e => e.category === 'file').length,
    networkCount: telemetry.events.filter(e => e.category === 'network').length,
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <PageHeader
        title="Live Telemetry Stream"
        subtitle="Real-time forensic event monitoring"
        actions={
          <>
            <StatusBadge status={telemetry.isConnected ? 'active' : 'closed'} size="sm" />
            <Button variant={telemetry.isPaused ? 'outline' : 'solid'} size="sm" onClick={() => telemetry.togglePause()}>
              {telemetry.isPaused ? <PlayIcon className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {telemetry.isPaused ? 'Resume Stream' : 'Pause Stream'}
            </Button>
          </>
        }
      />

      <PageGrid columns={4}>
        <DashboardCard>
          <DashboardStat
            label="Total Events"
            value={stats.totalEvents}
            icon={<Activity className="w-5 h-5 text-amber-600 " />}
            delta={telemetry.isConnected ? 'Live stream active' : 'Disconnected'}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Process Events"
            value={stats.processCount}
            icon={<Cpu className="w-5 h-5 text-blue-600 " />}
            delta="Process activity"
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="File Events"
            value={stats.fileCount}
            icon={<FileText className="w-5 h-5 text-orange-600  " />}
            delta="File system activity"
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Network Events"
            value={stats.networkCount}
            icon={<Network className="w-5 h-5 text-red-600  " />}
            delta="Network activity"
          />
        </DashboardCard>
      </PageGrid>

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--text-secondary)] " />
            <span className="text-sm text-[var(--text-secondary)] ">Filters:</span>
          </div>
          <Select
            value={typeFilter}
            onChange={(val) => setTypeFilter(val)}
            options={[
              { value: 'all', label: 'All Event Types' },
              { value: 'process', label: 'Process' },
              { value: 'file', label: 'File' },
              { value: 'registry', label: 'Registry' },
              { value: 'network', label: 'Network' },
              { value: 'behavior', label: 'Behavior' },
              { value: 'anomaly', label: 'Anomaly' },
            ]}
          />
          <Select
            value={sourceFilter}
            onChange={(val) => setSourceFilter(val)}
            options={[
              { value: 'all', label: 'All Sources' },
              { value: 'sandbox', label: 'Sandbox' },
              { value: 'endpoint', label: 'Endpoint' },
              { value: 'network', label: 'Network' },
              { value: 'ai', label: 'AI' },
            ]}
          />
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => telemetry.toggleAutoScroll()}
              className={cn(
                'p-1.5 rounded transition-colors',
                telemetry.autoScroll ? 'bg-amber-500/20 text-amber-600 ' : 'text-[var(--text-secondary)]  hover:text-[var(--text-secondary)]'
              )}
              title={telemetry.autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
            >
              {telemetry.autoScroll ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
            </button>
            <button
              onClick={() => telemetry.clear()}
              className="p-1.5 rounded text-[var(--text-secondary)]  hover:text-[var(--text-secondary)] transition-colors"
              title="Clear"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)] ">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-[var(--text-primary)] ">Event Stream</h2>
            <span className="text-xs text-[var(--text-secondary)] ">{filteredEvents.length} events</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', telemetry.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500')} />
            <span className="text-xs text-[var(--text-secondary)]">{telemetry.isConnected ? 'Live' : 'Disconnected'}</span>
          </div>
        </div>
        <div
          ref={streamContainerRef}
          className="divide-y divide-[var(--border-subtle)]  max-h-[600px] overflow-y-auto"
        >
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
              <Activity className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-lg font-medium">No telemetry events</p>
              <p className="text-sm mt-1">Start a sandbox session to capture live forensic events</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredEvents.map((event, index) => {
                const Icon = eventTypeIcons[event.category] || Activity;
                const colorClass = eventTypeColors[event.category] || 'bg-slate-500';
                const isLatest = index === 0;

                return (
                  <motion.div
                    key={`${event.session_id}-${event.timestamp}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    className="px-5 py-3 hover:bg-[var(--surface-container-lowest)]  transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn('w-3 h-3 rounded-full', colorClass, isLatest && 'animate-pulse')} />
                      <div className="w-8 h-8 rounded-lg bg-[var(--surface-container-low)]  flex items-center justify-center">
                        <Icon className="w-4 h-4 text-[var(--text-secondary)] " />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium uppercase text-[var(--text-secondary)] ">{event.category}</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">{event.event_type}</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">{new Date(event.timestamp).toLocaleTimeString()}</span>
                        </div>
                        {event.data && Object.keys(event.data).length > 0 && (
                          <pre className="text-xs text-[var(--text-secondary)]  mt-1 font-mono truncate">
                            {JSON.stringify(event.data)}
                          </pre>
                        )}
                      </div>
                      {isLatest && (
                        <span className="px-2 py-1 text-xs bg-emerald-100  text-emerald-700   rounded-full">Latest</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
          <div ref={streamEndRef} />
        </div>
      </Card>
    </motion.div>
  );
}

export default LiveTelemetryPage;
