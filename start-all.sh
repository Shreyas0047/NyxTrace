#!/usr/bin/env bash
set -euo pipefail

# NyxTrace Linux Orchestrator
# Launches backend → AI service → sandbox agent → frontend in dependency order
# with health-check polling.
#
# Usage:
#   chmod +x start-all.sh
#   ./start-all.sh
#
# To skip a service, set SKIP_{BLOCKCHAIN,BACKEND,OLLAMA,AI,SANDBOX,FRONTEND}=1:
#   SKIP_SANDBOX=1 ./start-all.sh
#   SKIP_BLOCKCHAIN=1 ./start-all.sh

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn()  { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARN${NC} $*"; }
err()   { echo -e "${RED}[$(date +%H:%M:%S)] ERROR${NC} $*"; }

_pid=""

cleanup() {
  log "Shutting down all services..."
  for pid in $(jobs -p); do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  log "All services stopped."
}
trap cleanup EXIT INT TERM

health_ok() {
  local url="$1" label="$2" max_wait="${3:-30}"
  log "Waiting for $label to be ready..."
  for i in $(seq 1 "$max_wait"); do
    if curl -sf "$url" >/dev/null 2>&1; then
      log "$label is ready."
      return 0
    fi
    sleep 1
  done
  err "$label did not become ready within ${max_wait}s"
  return 1
}

# ─── Blockchain (Hardhat Node) ────────────────────────────────────────────
if [ -z "${SKIP_BLOCKCHAIN:-}" ]; then
  log "Starting Blockchain (Hardhat Node)..."
  cd "$ROOT_DIR/blockchain"
  if [ ! -d node_modules ]; then
    npm install --silent 2>/dev/null
  fi
  npx hardhat node > "$LOG_DIR/blockchain.log" 2>&1 &
  # Health check via JSON-RPC eth_blockNumber
  BLOCKCHAIN_READY=""
  for i in $(seq 1 30); do
    if curl -sf -X POST -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
      http://127.0.0.1:8545 >/dev/null 2>&1; then
      log "Hardhat node ready on port 8545"
      BLOCKCHAIN_READY="1"
      break
    fi
    sleep 1
  done
  if [ -n "$BLOCKCHAIN_READY" ]; then
    log "Deploying EvidenceRegistry contract..."
    npx hardhat run scripts/deploy.ts --network localhost >> "$LOG_DIR/blockchain.log" 2>&1 || \
      warn "Contract deploy failed — deploy manually: cd blockchain && npx hardhat run scripts/deploy.ts --network localhost"
  else
    warn "Hardhat node did not become ready within 30s — blockchain features unavailable"
  fi
  cd "$ROOT_DIR"
else
  warn "Skipping Blockchain"
fi

# ─── Backend ─────────────────────────────────────────────────────────────
if [ -z "${SKIP_BACKEND:-}" ]; then
  log "Starting Backend (Express.js)..."
  # Kill any stale process on port 3000 to prevent EADDRINUSE crash  stale_pid=$(ss -tlnp 'sport = :3000' 2>/dev/null | grep -oP 'pid=[0-9]+' | head -1 | cut -d= -f2)  if [ -n "$stale_pid" ]; then    log "Port 3000 in use by PID $stale_pid — attempting cleanup"    kill "$stale_pid" 2>/dev/null || true    sleep 1  fi  cd "$ROOT_DIR/backend"
  npm run dev > "$LOG_DIR/backend.log" 2>&1 &
  _pid=$!
  health_ok "http://localhost:3000/api/v1/operations/live" "Backend" 60 || log "Backend health check failed"
  cd "$ROOT_DIR"
else
  warn "Skipping Backend"
fi

# ─── Ollama (LLM backend for AI Service) ────────────────────────────────
OLLAMA_AVAILABLE=""
if [ -z "${SKIP_OLLAMA:-}" ]; then
  if command -v ollama &>/dev/null; then
    if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
      log "Ollama already running"
      OLLAMA_AVAILABLE="1"
    else
      log "Starting Ollama (LLM backend)..."
      nohup ollama serve > "$LOG_DIR/ollama.log" 2>&1 &
      if health_ok "http://localhost:11434/api/tags" "Ollama" 30; then
        OLLAMA_AVAILABLE="1"
      fi
    fi
  else
    warn "Ollama not installed — LLM features won't be available (see ai-service/ollama_setup.sh)"
  fi
else
  warn "Skipping Ollama"
fi

# Pull the model (fast if cached, downloads ~2 GB on first run)
if [ -n "$OLLAMA_AVAILABLE" ]; then
  OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2}"
  if ollama list 2>/dev/null | grep -q "$OLLAMA_MODEL"; then
    log "Model $OLLAMA_MODEL already cached"
  else
    log "Pulling model $OLLAMA_MODEL (may take a few minutes on first run)..."
    ollama pull "$OLLAMA_MODEL" 2>&1 | tail -1 || true
  fi
fi

# ─── AI Service ──────────────────────────────────────────────────────────
if [ -z "${SKIP_AI:-}" ]; then
  log "Starting AI Service (FastAPI)..."
  cd "$ROOT_DIR/ai-service"
  if [ ! -d .venv ]; then
    python3 -m venv .venv
  fi
  source .venv/bin/activate
  pip install -q -r requirements.txt 2>/dev/null
  # Auto-enable LLM when Ollama is running (respects user's existing env vars)
  if [ -n "$OLLAMA_AVAILABLE" ]; then
    : "${AI_LLM_ENABLED:=true}"
    : "${AI_LLM_PRIMARY_PATH:=true}"
  fi
  AI_LLM_ENABLED="${AI_LLM_ENABLED:-false}" \
  AI_LLM_PRIMARY_PATH="${AI_LLM_PRIMARY_PATH:-false}" \
  uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 > "$LOG_DIR/ai-service.log" 2>&1 &
  health_ok "http://localhost:8000/health" "AI Service" 30 || true
  cd "$ROOT_DIR"
else
  warn "Skipping AI Service"
fi

# ─── Sandbox Agent ──────────────────────────────────────────────────────
if [ -z "${SKIP_SANDBOX:-}" ]; then
  log "Starting Sandbox Agent (FastAPI)..."
  cd "$ROOT_DIR/sandbox-agent-v2"
  if [ ! -d .venv ]; then
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -q -r requirements.txt 2>/dev/null
  fi
  source .venv/bin/activate
  python3 main.py > "$LOG_DIR/sandbox-agent.log" 2>&1 &
  health_ok "http://127.0.0.1:8765/health" "Sandbox Agent" 30 || true
  cd "$ROOT_DIR"
else
  warn "Skipping Sandbox Agent"
fi

# ─── Frontend ────────────────────────────────────────────────────────────
if [ -z "${SKIP_FRONTEND:-}" ]; then
  log "Starting Frontend (Vite)..."
  cd "$ROOT_DIR/frontend"
  npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
  cd "$ROOT_DIR"
  log "Frontend starting at http://localhost:5173"
else
  warn "Skipping Frontend"
fi

log "═══════════════════════════════════════════════════════════════"
log "  All services launched. Press Ctrl+C to stop everything."
log "  Logs: $LOG_DIR/"
log "  Frontend:  http://localhost:5173"
log "  Backend:   http://localhost:3000/api/v1"
log "  AI:        http://localhost:8000"
log "  Ollama:    http://localhost:11434"
log "  Sandbox:   http://127.0.0.1:8765"
log "  Blockchain: http://127.0.0.1:8545"
log "═══════════════════════════════════════════════════════════════"

wait
