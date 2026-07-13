import { create } from 'zustand';
import api from '../services/api';
import type { TelemetryEvent } from '../types';

interface TelemetryState {
  events: TelemetryEvent[];
  isConnected: boolean;
  isPaused: boolean;
  autoScroll: boolean;
  maxEvents: number;
  currentSessionId: string | null;
  connect: (sessionId?: string) => void;
  disconnect: () => void;
  addEvent: (event: TelemetryEvent) => void;
  clear: () => void;
  togglePause: () => void;
  toggleAutoScroll: () => void;
  setMaxEvents: (max: number) => void;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let shouldReconnect = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

const eventKey = (event: TelemetryEvent) =>
  `${event.session_id || ''}:${event.timestamp || ''}:${event.event_type || ''}:${JSON.stringify(event.data || {})}`;

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  events: [],
  isConnected: false,
  isPaused: false,
  autoScroll: true,
  maxEvents: 500,
  currentSessionId: null,

  connect: (sessionId?: string) => {
    const { disconnect, addEvent } = get();
    disconnect();
    shouldReconnect = true;

    reconnectAttempts = 0;
    set({ currentSessionId: sessionId || null });
    api.getSandboxTelemetryUrl().then((response) => {
      if (response.success && response.data?.url) {
        ws = new WebSocket(response.data.url);

        ws.onopen = () => {
          set({ isConnected: true });
          reconnectAttempts = 0;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as TelemetryEvent;
            if (!get().isPaused) {
              addEvent(data);
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
              get().connect(get().currentSessionId || undefined);
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
      console.error('Telemetry WebSocket connection failed:', err);
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
    set({ isConnected: false, currentSessionId: null });
  },

  addEvent: (event: TelemetryEvent) => {
    set((state) => {
      const key = eventKey(event);
      if (state.events.some((existing) => eventKey(existing) === key)) {
        return state;
      }
      const newEvents = [...state.events, event];
      if (newEvents.length > state.maxEvents) {
        newEvents.splice(0, newEvents.length - state.maxEvents);
      }
      return { events: newEvents };
    });
  },

  clear: () => set({ events: [] }),

  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),

  toggleAutoScroll: () => set((state) => ({ autoScroll: !state.autoScroll })),

  setMaxEvents: (max: number) => set({ maxEvents: max }),
}));

