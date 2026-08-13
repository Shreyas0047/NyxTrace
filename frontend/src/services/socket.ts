/**
 * Real-Time Socket Client Service
 * Enterprise-grade WebSocket client for forensic telemetry streaming
 */

import { io, type Socket } from 'socket.io-client';

export const SocketEvent = {
  // Connection Events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  AUTH_SUCCESS: 'auth_success',
  AUTH_FAILURE: 'auth_failure',

  // Telemetry Events
  TELEMETRY_EVENT: 'telemetry:event',
  TELEMETRY_BATCH: 'telemetry:batch',

  // Investigation Events
  INVESTIGATION_UPDATE: 'investigation:update',
  INVESTIGATION_CREATE: 'investigation:create',
  INVESTIGATION_STATUS_CHANGE: 'investigation:status_change',
  EVIDENCE_UPDATE: 'evidence:update',
  EVIDENCE_UPLOAD: 'evidence:upload',

  // Alert Events
  ALERT_NEW: 'alert:new',
  ALERT_UPDATE: 'alert:update',
  ALERT_ESCALATE: 'alert:escalate',

  // Sandbox Events
  SANDBOX_SESSION_START: 'sandbox:session_start',
  SANDBOX_SESSION_END: 'sandbox:session_end',
  SANDBOX_SESSION_UPDATE: 'sandbox:session_update',
  SANDBOX_TELEMETRY: 'sandbox:telemetry',
  SANDBOX_ERROR: 'sandbox:error',
  SANDBOX_ROLLBACK: 'sandbox:rollback',

  // AI Analysis Events
  AI_ANALYSIS_START: 'ai:analysis_start',
  AI_ANALYSIS_COMPLETE: 'ai:analysis_complete',
  AI_ANALYSIS_UPDATE: 'ai:analysis_update',
  AI_ANOMALY_DETECTED: 'ai:anomaly_detected',
  AI_THREAT_CLASSIFICATION: 'ai:threat_classification',

  // Dashboard Events
  DASHBOARD_STATS_UPDATE: 'dashboard:stats_update',
  DASHBOARD_ALERT_COUNT: 'dashboard:alert_count',

  // System Events
  SYSTEM_NOTIFICATION: 'system:notification',
  PING: 'ping',
  PONG: 'pong',
} as const;

export interface TelemetryEvent {
  session_id: string;
  timestamp: string;
  event_type: string;
  category: string;
  data: Record<string, unknown>;
  suspiciousScore?: number;
}

export interface InvestigationUpdate {
  id: string;
  caseNumber: string;
  status?: string;
  priority?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface AlertNotification {
  id: string;
  alertId: string;
  title: string;
  severity: string;
  status: string;
  source: string;
  detectedAt: string;
}

export interface SandboxSessionUpdate {
  id: string;
  sessionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  eventsCollected?: number;
  progress?: number;
  errorMessage?: string;
}

export interface DashboardStatsUpdate {
  activeInvestigations?: number;
  criticalAlerts?: number;
  totalEvidence?: number;
  sandboxSessions?: number;
  timestamp: string;
}

export interface AIAnalysisUpdate {
  investigationId: string;
  analysisId: string;
  status: 'processing' | 'completed' | 'failed';
  threatType?: string;
  confidence?: number;
  severityScore?: number;
  recommendations?: string[];
}

type EventCallback<T = unknown> = (data: T) => void;

const debugSocket = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.debug(...args);
  }
};

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  // Get the WebSocket URL from environment or use default
  private getSocketUrl(): string {
    const wsUrl = import.meta.env.VITE_WS_URL;
    if (wsUrl) return wsUrl;
    const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
    if (apiUrl.startsWith('/')) {
      // Relative API path (dev default): backend serves socket.io on the same
      // origin as the API server, not the Vite dev server.
      return import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
    }
    return apiUrl.replace(/\/api\/v1\/?$/, '');
  }

  // Connect to WebSocket server
  connect(): void {
    if (this.socket?.connected || this.socket?.active) {
      debugSocket('[Socket] Already connected or connecting');
      return;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const token = localStorage.getItem('accessToken');

    this.socket = io(this.getSocketUrl(), {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: token ? { token } : undefined,
    });

    this.setupEventHandlers();
  }

  // Setup socket event handlers
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      debugSocket('[Socket] Connected:', this.socket?.id);
      this.isConnected = true;
      this.emitEvent(SocketEvent.CONNECT);
    });

    this.socket.on('disconnect', (reason: string) => {
      debugSocket('[Socket] Disconnected:', reason);
      this.isConnected = false;
      this.emitEvent(SocketEvent.DISCONNECT, reason);
    });

    this.socket.on('auth_success', (data: { userId: string; role: string }) => {
      debugSocket('[Socket] Authenticated:', data);
      this.emitEvent(SocketEvent.AUTH_SUCCESS, data);
    });

    this.socket.on('auth_failure', (data: { message: string }) => {
      console.warn('[Socket] Auth failed:', data);
      this.emitEvent(SocketEvent.AUTH_FAILURE, data);
    });

    // Forward all events to registered listeners
    this.setupForwardingEvents();

    // Connection error handling
    this.socket.on('connect_error', (error: Error) => {
      console.error('[Socket] Connection error:', error.message);
      this.emitEvent('connection_error', error);
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      debugSocket('[Socket] Reconnected after', attemptNumber, 'attempts');
    });

    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      debugSocket('[Socket] Reconnection attempt:', attemptNumber);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed after max attempts');
      this.emitEvent('connection_error', new Error('Max reconnection attempts reached'));
    });
  }

  // Setup forwarding for all major events
  private setupForwardingEvents(): void {
    if (!this.socket) return;

    // Telemetry events
    this.socket.on(SocketEvent.TELEMETRY_EVENT, (data: TelemetryEvent) => {
      this.emitEvent(SocketEvent.TELEMETRY_EVENT, data);
    });

    // Investigation events
    this.socket.on(SocketEvent.INVESTIGATION_UPDATE, (data: InvestigationUpdate) => {
      this.emitEvent(SocketEvent.INVESTIGATION_UPDATE, data);
    });

    // Alert events
    this.socket.on(SocketEvent.ALERT_NEW, (data: AlertNotification) => {
      this.emitEvent(SocketEvent.ALERT_NEW, data);
    });

    this.socket.on(SocketEvent.ALERT_UPDATE, (data: AlertNotification) => {
      this.emitEvent(SocketEvent.ALERT_UPDATE, data);
    });

    // Sandbox events
    this.socket.on(SocketEvent.SANDBOX_SESSION_UPDATE, (data: SandboxSessionUpdate) => {
      this.emitEvent(SocketEvent.SANDBOX_SESSION_UPDATE, data);
    });

    this.socket.on(SocketEvent.SANDBOX_TELEMETRY, (data: TelemetryEvent) => {
      this.emitEvent(SocketEvent.SANDBOX_TELEMETRY, data);
    });

    // AI Analysis events
    this.socket.on(SocketEvent.AI_ANALYSIS_COMPLETE, (data: AIAnalysisUpdate) => {
      this.emitEvent(SocketEvent.AI_ANALYSIS_COMPLETE, data);
    });

    this.socket.on(SocketEvent.AI_ANOMALY_DETECTED, (data: AIAnalysisUpdate) => {
      this.emitEvent(SocketEvent.AI_ANOMALY_DETECTED, data);
    });

    // Dashboard events
    this.socket.on(SocketEvent.DASHBOARD_STATS_UPDATE, (data: DashboardStatsUpdate) => {
      this.emitEvent(SocketEvent.DASHBOARD_STATS_UPDATE, data);
    });

    // System notifications
    this.socket.on(SocketEvent.SYSTEM_NOTIFICATION, (data: unknown) => {
      this.emitEvent(SocketEvent.SYSTEM_NOTIFICATION, data);
    });
  }

  // Emit event to local listeners
  private emitEvent<T>(event: string, data?: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[Socket] Error in listener for ${event}:`, error);
        }
      });
    }
  }

  // Subscribe to specific investigation updates
  subscribeToInvestigation(investigationId: string): void {
    this.socket?.emit('subscribe:investigation', investigationId);
    debugSocket(`[Socket] Subscribed to investigation: ${investigationId}`);
  }

  // Unsubscribe from investigation updates
  unsubscribeFromInvestigation(investigationId: string): void {
    this.socket?.emit('unsubscribe:investigation', investigationId);
    debugSocket(`[Socket] Unsubscribed from investigation: ${investigationId}`);
  }

  // Subscribe to sandbox session updates
  subscribeToSandboxSession(sessionId: string): void {
    this.socket?.emit('subscribe:sandbox', sessionId);
    debugSocket(`[Socket] Subscribed to sandbox session: ${sessionId}`);
  }

  // Unsubscribe from sandbox updates
  unsubscribeFromSandboxSession(sessionId: string): void {
    this.socket?.emit('unsubscribe:sandbox', sessionId);
    debugSocket(`[Socket] Unsubscribed from sandbox session: ${sessionId}`);
  }

  // Register event listener
  on<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback as EventCallback);
      }
    };
  }

  // Register one-time event listener
  once<T = unknown>(event: string, callback: EventCallback<T>): void {
    const unsubscribe = this.on<T>(event, (data) => {
      unsubscribe();
      callback(data);
    });
  }

  // Remove specific event listener
  off(event: string, callback?: EventCallback): void {
    if (callback) {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
      }
    } else {
      this.listeners.delete(event);
    }
  }

  // Disconnect from server
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      debugSocket('[Socket] Disconnected');
    }
  }

  // Reconnect
  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  // Get connection status
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Get socket ID
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  // Send ping for connection health check
  ping(): void {
    this.socket?.emit(SocketEvent.PING);
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;

// React hook for socket connection
export function useSocket() {
  return socketService;
}
