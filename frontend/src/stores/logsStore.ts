import { create } from 'zustand';
import api from '../services/api';
import type { LogEntry } from '../types/reports';

export interface SystemLogEntry {
  timestamp: string;
  level: string;
  message: string;
  session_id?: string;
  source?: string;
  state?: string;
  data?: Record<string, any>;
}

interface LogsState {
  logs: LogEntry[];
  entries: SystemLogEntry[];
  isLoading: boolean;
  error: string | null;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: { level: string; category: string; search: string };
  autoRefresh: boolean;
  stats: {
    totalLines: number;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
    files: string[];
  } | null;
  isConnected: boolean;
  isPaused: boolean;
  autoScroll: boolean;
  maxEntries: number;
  filterLevel: string;
  filterText: string;
  fetchLogs: (params?: Partial<LogsState['filters'] & { page: number; limit: number }>) => Promise<void>;
  fetchStats: () => Promise<void>;
  setFilters: (filters: Partial<LogsState['filters']>) => void;
  toggleAutoRefresh: () => void;
  clearLogs: () => void;
  downloadLogs: () => void;
  connect: () => void;
  disconnect: () => void;
  addEntry: (entry: SystemLogEntry) => void;
  clear: () => void;
  togglePause: () => void;
  toggleAutoScroll: () => void;
  setFilterLevel: (level: string) => void;
  setFilterText: (text: string) => void;
  fetchHistorical: (limit?: number, level?: string) => Promise<void>;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let shouldReconnect = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

const logKey = (entry: SystemLogEntry) =>
  `${entry.timestamp || ''}:${entry.level || ''}:${entry.session_id || ''}:${entry.message || ''}`;

const normalizeLog = (entry: any, index: number): LogEntry => ({
  id: entry.id || entry._id || `${entry.timestamp || Date.now()}-${index}`,
  timestamp: entry.timestamp || new Date().toISOString(),
  level: (entry.level || 'info').toLowerCase(),
  category: entry.category || entry.source || 'system',
  message: entry.message || '',
  source: entry.source,
  details: entry.details || entry.data,
  sessionId: entry.sessionId || entry.session_id,
});

export const useLogsStore = create<LogsState>((set, get) => ({
  logs: [],
  entries: [],
  isLoading: false,
  error: null,
  pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
  filters: { level: '', category: '', search: '' },
  autoRefresh: false,
  stats: null,
  isConnected: false,
  isPaused: false,
  autoScroll: true,
  maxEntries: 1000,
  filterLevel: 'all',
  filterText: '',

  fetchLogs: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const { filters, pagination } = get();
      const merged = { ...filters, ...params };
      const page = merged.page ?? pagination.page;
      const limit = merged.limit ?? pagination.limit;
      const response = await api.getLogs({
        page,
        limit,
        level: merged.level || undefined,
        category: merged.category || undefined,
        search: merged.search || undefined,
      });

      if (response.success && response.data) {
        set({
          logs: response.data.map(normalizeLog),
          filters: {
            level: merged.level || '',
            category: merged.category || '',
            search: merged.search || '',
          },
          pagination: {
            page: response.meta?.page || page,
            limit: response.meta?.limit || limit,
            total: response.meta?.total || response.data.length,
            totalPages: response.meta?.totalPages || 1,
          },
          isLoading: false,
        });
      } else {
        set({ isLoading: false, error: response.message || 'Failed to load logs' });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load logs' });
    }
  },

  fetchStats: async () => {
    try {
      const response = await api.getLogStats();
      if (response.success && response.data) {
        set({ stats: response.data });
      }
    } catch {
      set({ stats: null });
    }
  },

  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),

  toggleAutoRefresh: () => set((state) => ({ autoRefresh: !state.autoRefresh })),

  clearLogs: () => set({ logs: [] }),

  downloadLogs: () => {
    const { logs } = get();
    const blob = new Blob([logs.map((log) => `[${log.timestamp}] ${log.level.toUpperCase()} ${log.category}: ${log.message}`).join('\n')], {
      type: 'text/plain',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `forensics_logs_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  },

  connect: () => {
    const { disconnect, addEntry } = get();
    disconnect();
    shouldReconnect = true;

    reconnectAttempts = 0;
    api.getSandboxLogsUrl().then((response) => {
      if (response.success && response.data?.url) {
        ws = new WebSocket(response.data.url);

        ws.onopen = () => {
          set({ isConnected: true });
          reconnectAttempts = 0;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as SystemLogEntry;
            if (!get().isPaused) {
              addEntry(data);
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          set({ isConnected: false });
          if (!shouldReconnect) return;
          const attempt = reconnectAttempts + 1;
          reconnectAttempts = attempt;
          if (attempt > MAX_RECONNECT_ATTEMPTS) {
            shouldReconnect = false;
            return;
          }
          const delay = Math.min(3000 * Math.pow(1.5, attempt - 1), 30000);
          reconnectTimer = setTimeout(() => {
            if (shouldReconnect) {
              get().connect();
            }
          }, delay);
        };

        ws.onerror = () => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.close();
          }
        };
      }
    }).catch((err) => {
      console.error('Logs WebSocket connection failed:', err);
      set({ isConnected: false });
    });
  },

  disconnect: () => {
    shouldReconnect = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      ws = null;
    }
    set({ isConnected: false, entries: [] });
  },

  addEntry: (entry: SystemLogEntry) => {
    set((state) => {
      const key = logKey(entry);
      if (state.entries.some((existing) => logKey(existing) === key)) {
        return state;
      }
      const newEntries = [...state.entries, entry];
      if (newEntries.length > state.maxEntries) {
        newEntries.splice(0, newEntries.length - state.maxEntries);
      }
      return { entries: newEntries };
    });
  },

  clear: () => set({ entries: [] }),

  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),

  toggleAutoScroll: () => set((state) => ({ autoScroll: !state.autoScroll })),

  setFilterLevel: (level: string) => set({ filterLevel: level }),

  setFilterText: (text: string) => set({ filterText: text }),

  fetchHistorical: async (limit = 200, level?: string) => {
    try {
      const response = await api.getSandboxLogs(limit, level);
      if (response.success && response.data?.logs) {
        set({ entries: response.data.logs });
      }
    } catch {
      // ignore fetch errors
    }
  },
}));
