/**
 * Application config and environment validation.
 *
 * Centralises:
 *  - VITE_* environment values, validated at module load (fails fast in
 *    development, surfaces clearly in production builds).
 *  - Polling intervals, retry counts, and other tuning knobs that were
 *    previously hard-coded across components.
 *
 * Override defaults in `.env` files (see `.env.example`).
 */

type EnvShape = {
  apiUrl: string;
  aiServiceUrl: string;
  blockchainExplorerUrl: string;
  appName: string;
  appVersion: string;
};

type Issue = { key: string; reason: string };

function readEnv(): { env: EnvShape; issues: Issue[] } {
  const issues: Issue[] = [];

  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';
  const aiServiceUrl = (import.meta.env.VITE_AI_SERVICE_URL as string | undefined) ?? 'http://localhost:8000';
  const blockchainExplorerUrl = (import.meta.env.VITE_BLOCKCHAIN_EXPLORER_URL as string | undefined) ?? 'https://sepolia.etherscan.io';
  const appName = (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'NyxTrace';
  const appVersion = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.0.0';

  // apiUrl must be either an absolute URL or start with '/'
  if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://') && !apiUrl.startsWith('/')) {
    issues.push({ key: 'VITE_API_URL', reason: `Expected http(s):// or '/'-prefixed path, got "${apiUrl}"` });
  }

  // aiServiceUrl, when provided, must be absolute
  if (aiServiceUrl && !aiServiceUrl.startsWith('http://') && !aiServiceUrl.startsWith('https://')) {
    issues.push({ key: 'VITE_AI_SERVICE_URL', reason: `Expected http(s):// URL, got "${aiServiceUrl}"` });
  }

  return { env: { apiUrl, aiServiceUrl, blockchainExplorerUrl, appName, appVersion }, issues };
}

const { env, issues } = readEnv();

if (issues.length > 0) {
  // In dev, throw so the developer fixes it. In prod, log loudly but continue
  // so a degraded UI still loads instead of a white screen.
  const message = `[config] Invalid environment configuration:\n${issues.map((i) => `  - ${i.key}: ${i.reason}`).join('\n')}`;
  if (import.meta.env.DEV) {
    throw new Error(message);
  } else {
    // eslint-disable-next-line no-console
    console.error(message);
  }
}

export const config = {
  env,

  /** Periodic refresh intervals (milliseconds). */
  polling: {
    /** Connection-status banner refresh. */
    connectionHealthMs: 15_000,
    /** System Health page service-status refresh. */
    systemHealthMs: 15_000,
    /** Sandbox session state poll while a session is active. */
    sandboxSessionMs: 3_000,
    /** Maximum number of session polls before giving up (~3000ms each). */
    sandboxSessionMaxAttempts: 90,
  },

  /** API client behaviour. */
  api: {
    /** Default request timeout. */
    requestTimeoutMs: 10_000,
    /** Long-running endpoints (e.g. start session) get this. */
    longRequestTimeoutMs: 20_000,
    /** Number of retries on network/5xx errors before surfacing failure. */
    maxRetries: 2,
    /** TTL for the request-deduplication cache. */
    dedupTtlMs: 1_000,
  },

  /** Realtime / WebSocket. */
  realtime: {
    telemetryBufferSize: 50,
    liveAlertsBufferSize: 20,
  },
} as const;

export type AppConfig = typeof config;
export default config;
