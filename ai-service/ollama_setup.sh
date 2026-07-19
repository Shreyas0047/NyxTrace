#!/usr/bin/env bash
set -euo pipefail

echo "=== NyxTrace AI Service — Ollama Setup ==="

detect_arch() {
  local arch
  arch=$(uname -m)
  case "$arch" in
    x86_64)  echo "amd64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
  esac
}

# Install Ollama if not present
if ! command -v ollama &>/dev/null; then
  echo "[1/4] Installing Ollama..."
  if [[ "$(uname)" == "Linux" ]]; then
    curl -fsSL https://ollama.com/install.sh | sh
  elif [[ "$(uname)" == "Darwin" ]]; then
    if command -v brew &>/dev/null; then
      brew install ollama
    else
      curl -fsSL https://ollama.com/install.sh | sh
    fi
  else
    echo "Unsupported OS: $(uname)" >&2
    exit 1
  fi
else
  echo "[1/4] Ollama already installed ($(ollama --version))"
fi

# Start Ollama service if not running
if ! curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "[2/4] Starting Ollama service..."
  if [[ "$(uname)" == "Linux" ]]; then
    nohup ollama serve >/tmp/ollama.log 2>&1 &
    OLLAMA_PID=$!
    echo "  -> PID $OLLAMA_PID (log: /tmp/ollama.log)"
  elif [[ "$(uname)" == "Darwin" ]]; then
    open -a Ollama
  fi
  # Wait for it to be ready
  for i in $(seq 1 30); do
    if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
      echo "  -> ready after ${i}s"
      break
    fi
    sleep 1
  done
else
  echo "[2/4] Ollama already running"
fi

# Pull the model
MODEL="${OLLAMA_MODEL:-llama3.2}"
echo "[3/4] Pulling model: $MODEL"
ollama pull "$MODEL"

# Verify
echo "[4/4] Verification..."
if ollama list | grep -q "$MODEL"; then
  echo "  -> Model $MODEL is available"
else
  echo "  -> ERROR: $MODEL not found after pull" >&2
  exit 1
fi

# Quick test
echo ""
echo "=== Quick test ==="
curl -s http://localhost:11434/api/generate \
  -d "{\"model\": \"$MODEL\", \"prompt\": \"Say 'Ollama ready' and nothing else.\", \"stream\": false}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('response','').strip())"

echo ""
echo "=== Setup complete ==="
echo "To enable LLM analysis, set these in your .env:"
echo "  AI_LLM_ENABLED=true"
echo "  AI_LLM_PRIMARY_PATH=true"
echo "  AI_LLM_OLLAMA_MODEL=$MODEL"
echo ""
echo "Or run the AI service with:"
echo "  AI_LLM_ENABLED=true AI_LLM_PRIMARY_PATH=true .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
