import { create } from 'zustand';
import type { SandboxSession, PaginationParams } from '../types';
import api from '../services/api';

interface Simulator {
  id: string;
  display_name: string;
  description: string;
  category: string;
}

interface RuntimeHealth {
  status: string;
  version: string;
  uptime_seconds: number;
  vm_status: Record<string, any>;
  active_sessions: number;
  telemetry_connections: number;
}

interface MonitoringStatus {
  enabled: boolean;
  total_events?: number;
  process_count?: number;
  file_operations_count?: number;
  registry_operations_count?: number;
  network_operations_count?: number;
  behavior_alerts?: number;
  suspicious_activities?: unknown[];
  events_by_category?: Record<string, number>;
  events_by_severity?: Record<string, number>;
}

interface ExecutionStatus {
  history_count: number;
  current_session: unknown;
  recent_sessions: Array<{
    session_id: string;
    status: string;
    simulator_id: string;
  }>;
}

interface ActiveSession {
  session_id: string;
  state: string;
  simulator_id: string;
  created_at: string;
  updated_at: string;
  error?: string;
}

interface SandboxState {
  sessions: SandboxSession[];
  currentSession: SandboxSession | null;
  stats: {
    total: number;
    byStatus: Record<string, number>;
    avgDuration: number;
  } | null;
  simulators: Simulator[];
  health: RuntimeHealth | null;
  monitoringStatus: MonitoringStatus | null;
  executionStatus: ExecutionStatus | null;
  activeSession: ActiveSession | null;
  isLoading: boolean;
  isExecuting: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  fetchSessions: (params: PaginationParams) => Promise<void>;
  fetchSession: (id: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchSimulators: () => Promise<void>;
  fetchHealth: () => Promise<boolean>;
  fetchMonitoringStatus: () => Promise<void>;
  fetchExecutionStatus: () => Promise<void>;
  startSession: (simulatorId: string, options?: { auto_rollback?: boolean; timeout_seconds?: number }) => Promise<{ success: boolean; sessionId?: string; message: string }>;
  stopSession: (sessionId: string) => Promise<{ success: boolean; message: string }>;
  terminateSession: (sessionId: string) => Promise<{ success: boolean; message: string }>;
  resetVm: () => Promise<{ success: boolean; message: string }>;
  startRuntime: () => Promise<{ success: boolean; message: string }>;
  clearCurrentSession: () => void;
}

function normalizeSession(session: any): SandboxSession & { simulator: string; error?: string } {
  return {
    ...session,
    id: session.id || session._id || session.sessionId || session.session_id,
    sessionId: session.sessionId || session.session_id,
    simulatorId: session.simulatorId || session.simulator_id || session.simulator,
    simulatorName: session.simulatorName || session.simulator_name || session.simulator_id || session.simulator,
    simulator: session.simulatorName || session.simulator || session.simulatorId || session.simulator_id,
    startTime: session.startTime || session.created_at || session.createdAt,
    endTime: session.endTime || session.updated_at,
    status: session.status || session.state || 'pending',
    duration: Math.floor(session.duration || 0),
    eventsCollected: session.eventsCollected || session.events_collected || 0,
    evidenceFiles: session.evidenceFiles || [],
    errorMessages: session.errorMessages || (session.error ? [session.error] : []),
    error: session.error || session.errorMessages?.[0],
  };
}

export const useSandboxStore = create<SandboxState>((set, get) => ({
  sessions: [],
  currentSession: null,
  stats: null,
  simulators: [],
  health: null,
  monitoringStatus: null,
  executionStatus: null,
  activeSession: null,
  isLoading: false,
  isExecuting: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },

  fetchSessions: async (params: PaginationParams) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getSandboxSessions(params);
      if (response.success && response.data) {
        const sessions = response.data.map(normalizeSession);
        set({
          sessions,
          pagination: {
            page: response.meta?.page || 1,
            limit: response.meta?.limit || 20,
            total: response.meta?.total || 0,
            totalPages: response.meta?.totalPages || 0,
          },
          activeSession: get().activeSession || null,
          isLoading: false,
        });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch sandbox sessions' });
    }
  },

  fetchSession: async (id: string) => {
    set({ isLoading: true, error: null, currentSession: null });
    try {
      const response = await api.getSandboxSession(id);
      if (response.success && response.data) {
        set({ currentSession: normalizeSession(response.data), isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch sandbox session' });
    }
  },

  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getSandboxStats();
      if (response.success && response.data) {
        set({ stats: response.data, isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch sandbox stats' });
    }
  },

  fetchSimulators: async () => {
    try {
      const response = await api.getSandboxSimulators();
      // Always update simulators (even to empty array on error)
      set({ simulators: response.data?.simulators || [] });
    } catch (error) {
      console.error('Failed to fetch simulators:', error);
      set({ simulators: [] });
    }
  },

  fetchHealth: async (): Promise<boolean> => {
    try {
      const response = await api.getSandboxHealth();
      if (response.success && response.data?.health) {
        set({ health: response.data.health });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to fetch sandbox health:', error);
      return false;
    }
  },

  fetchMonitoringStatus: async () => {
    try {
      const response = await api.getSandboxMonitoringStatus();
      if (response.success && response.data?.status) {
        set({ monitoringStatus: response.data.status as MonitoringStatus });
      }
    } catch (error) {
      console.error('Failed to fetch monitoring status:', error);
    }
  },

  fetchExecutionStatus: async () => {
    try {
      const response = await api.getSandboxExecutionStatus();
      if (response.success && response.data?.status) {
        const current = (response.data.status as any).current_session;
        if (current) {
          const state = current.state || current.status || 'running';
          set({
            executionStatus: response.data.status as ExecutionStatus,
            activeSession: {
              session_id: current.session_id || current.sessionId,
              state,
              simulator_id: current.simulator_id || current.simulatorId,
              created_at: current.created_at || current.startTime || new Date().toISOString(),
              updated_at: current.updated_at || current.updatedAt || new Date().toISOString(),
              error: current.error,
            },
          });
        } else {
          // No active session from runtime — clear activeSession if it was in a running state
          const prev = get().activeSession;
          set({
            executionStatus: response.data.status as ExecutionStatus,
            activeSession: prev && !['completed', 'failed', 'timeout', 'rolled_back'].includes(prev.state) ? null : prev,
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch execution status:', error);
    }
  },

  startSession: async (simulatorId: string, options = {}) => {
    set({ isExecuting: true, error: null });
    try {
      const response = await api.startSandboxSession({
        simulator_id: simulatorId,
        auto_rollback: options.auto_rollback ?? true,
        timeout_seconds: options.timeout_seconds ?? 300,
      });

      if (response.success && response.data?.session) {
        const session = response.data.session;
        set({
          activeSession: session,
          sessions: [normalizeSession(session), ...get().sessions.filter((s) => s.sessionId !== session.session_id)],
          isExecuting: false,
        });
        return { success: true, sessionId: session.session_id, message: 'Session started' };
      }

      set({ isExecuting: false, error: response.message || 'Failed to start session' });
      return { success: false, message: response.message || 'Failed to start session' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start session';
      set({ isExecuting: false, error: message });
      return { success: false, message };
    }
  },

  stopSession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.stopSandboxSession(sessionId);
      if (response.success) {
        set({ isLoading: false, activeSession: null, monitoringStatus: null, executionStatus: null });
        return { success: true, message: 'Session stopped' };
      }
      set({ isLoading: false, error: response.message || 'Failed to stop session' });
      return { success: false, message: response.message || 'Failed to stop session' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop session';
      set({ isLoading: false, error: message, activeSession: null });
      return { success: false, message };
    }
  },

  terminateSession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.terminateSandboxSession(sessionId);
      if (response.success) {
        set({ isLoading: false, activeSession: null, monitoringStatus: null, executionStatus: null });
        return { success: true, message: 'Session terminated and rolled back' };
      }
      set({ isLoading: false, error: response.message || 'Failed to terminate session' });
      return { success: false, message: response.message || 'Failed to terminate session' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to terminate session';
      set({ isLoading: false, error: message, activeSession: null });
      return { success: false, message };
    }
  },

  resetVm: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.resetSandboxVm();
      if (response.success) {
        set({ isLoading: false, activeSession: null });
        return { success: true, message: 'VM reset successfully' };
      }
      set({ isLoading: false, error: response.message || 'Failed to reset VM' });
      return { success: false, message: response.message || 'Failed to reset VM' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset VM';
      set({ isLoading: false, error: message });
      return { success: false, message };
    }
  },

  startRuntime: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.startSandboxRuntime();
      if (response.success) {
        if (response.message?.includes('already running')) {
          set({ isLoading: false });
          await get().fetchHealth();
          return { success: true, message: 'Runtime is already running' };
        }
        const maxAttempts = 15;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const healthy = await get().fetchHealth();
          if (healthy) {
            set({ isLoading: false });
            return { success: true, message: 'Runtime started successfully' };
          }
        }
        set({ isLoading: false, error: 'Runtime did not respond after 30s. Check sandbox-agent-v2 console for errors.' });
        return { success: false, message: 'Runtime may have failed to start. Check logs.' };
      }
      set({ isLoading: false, error: response.message || 'Failed to start runtime' });
      return { success: false, message: response.message || 'Failed to start runtime' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start runtime';
      set({ isLoading: false, error: message });
      return { success: false, message };
    }
  },

  clearCurrentSession: () => set({ currentSession: null, activeSession: null }),
}));
