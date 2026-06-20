# NyxTrace - Project Context

## Project Overview

**Name:** AI-Powered Cybercrime Digital NyxTrace with Blockchain Evidence Verification

**Purpose:** Educational cybersecurity platform for malware behavior simulation and forensic analysis in controlled VirtualBox sandbox environments. NOT offensive security tooling.

**Current Phase:** Production - Enterprise Hardening Complete

**Platform:** Windows 11 / VirtualBox 7.1.6 with ICH9 chipset

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                     Frontend (React + TypeScript + Vite)               │
│  src/                                                                  │
│  ├── pages/        Dashboard, Sandbox, Investigations, Evidence        │
│  ├── stores/       Zustand state (auth, sandbox, realtime)             │
│  ├── services/     API client, WebSocket client                        │
│  ├── components/   UI components, enterprise, blockchain               │
│  └── router/       React Router configuration                          │
└────────────────────────────────────────────────────────────────────────┘
            ↓↑ REST/WebSocket
┌────────────────────────────────────────────────────────────────────────┐
│                     Backend API (Express.js + TypeScript)              │
│  src/                                                                  │
│  ├── controllers/    Sandbox, Investigation, Evidence, Alert, AI       │
│  ├── services/       SandboxRuntimeService, SandboxSyncService         │
│  ├── routes/         API v1 endpoints                                  │
│  ├── models/         MongoDB schemas                                   │
│  └── middleware/     Auth, Security, Validation                        │
└────────────────────────────────────────────────────────────────────────┘
            ↓↑ HTTP + WebSocket
┌────────────────────────────────────────────────────────────────────────┐
│              Sandbox Runtime API (FastAPI - Python)                    │
│  sandbox-agent-v2/                                                     │
│  ├── main.py            Uvicorn entrypoint, listens on :8765           │
│  ├── agent/                                                            │
│  │   ├── app.py         FastAPI routes + WebSocket broadcasters        │
│  │   ├── pipeline.py    Session state machine (REVERT→STAGE→...)       │
│  │   ├── vm.py          VirtualBox VM manager                          │
│  │   └── models.py      Pydantic models                                │
│  └── simulators/        Six safe educational simulator modules         │
└────────────────────────────────────────────────────────────────────────┘
            ↓
┌────────────────────────────────────────────────────────────────────────┐
│                     VirtualBox VM (Windows 11)                         │
│  - Snapshot: CleanBaselinePython                                       │
│  - Execution: Headless mode                                            │
│  - Guest Additions: Required                                           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Repository Layout

```
backend/             Express.js API (TypeScript)
frontend/            React + TypeScript (Vite)
ai-service/          FastAPI AI microservice (Python)
sandbox-agent-v2/    FastAPI sandbox runtime + simulators (Python)
shared/              Shared schemas, contracts, services config
docs/                Runbooks and architecture notes
logs/                Local agent + monitoring logs
```

---

## Current Phase (Production)

### Platform Status: Enterprise Ready

All phases complete:

- Phase 1-3: Core platform with blockchain verification
- Phase 3.5-3.7: Chain of custody, threat intelligence, forensic analytics
- Phase 4: Enterprise hardening, resilience, health monitoring
- Phase 5-6: Headless sandbox runtime, web dashboard

---

## Sandbox Runtime Service

### Starting the Runtime

```powershell
cd sandbox-agent-v2
py -3.11 -m pip install -r requirements.txt
py -3.11 main.py
```

Default port: `8765`. The backend can also start it via `POST /api/v1/sandbox/runtime/start` (admin-only).

### Runtime API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Runtime health status |
| `/simulators` | GET | List available simulators |
| `/sessions` | GET | List all sessions |
| `/sessions/start` | POST | Start new session |
| `/sessions/{id}` | GET | Get session status |
| `/sessions/{id}/events` | GET | Get session telemetry events |
| `/sessions/{id}/stop` | POST | Stop session gracefully |
| `/sessions/{id}/terminate` | POST | Force terminate with rollback |
| `/vm/status` | GET | VM status |
| `/vm/reset` | POST | Reset VM to snapshot |
| `/monitoring/status` | GET | Monitoring statistics |
| `/execution/status` | GET | Execution history |
| `/logs` | GET | Runtime logs |
| `/telemetry/live` | WS | WebSocket telemetry stream |
| `/logs/live` | WS | WebSocket log stream |

---

## Backend Sandbox Endpoints

| Endpoint | Method | RBAC | Description |
|----------|--------|------|-------------|
| `/sandbox/health` | GET | All | Get runtime health |
| `/sandbox/simulators` | GET | Analyst+ | List simulators |
| `/sandbox/sessions` | GET | Analyst+ | List sessions |
| `/sandbox/sessions` | POST | Operator+ | Start session |
| `/sandbox/sessions/{id}` | GET | Analyst+ | Get session |
| `/sandbox/sessions/{id}/stop` | POST | Operator+ | Stop session |
| `/sandbox/sessions/{id}/terminate` | POST | Operator+ | Force terminate |
| `/sandbox/stats` | GET | Analyst+ | Session statistics |
| `/sandbox/telemetry-url` | GET | Analyst+ | WebSocket URL |
| `/sandbox/vm/reset` | POST | Operator+ | Reset VM |
| `/sandbox/vm/status` | GET | Analyst+ | VM status |
| `/sandbox/monitoring/status` | GET | Analyst+ | Monitoring status |
| `/sandbox/logs` | GET | Analyst+ | Runtime logs |
| `/sandbox/runtime/start` | POST | Admin | Start runtime service |

---

## Simulator IDs (Internal)

Source of truth: `sandbox-agent-v2/agent/app.py` (`SIMULATORS` list) and `sandbox-agent-v2/agent/pipeline.py` (`script_map`).

| Internal ID | Category | Behavior |
|-------------|----------|----------|
| `system-service-alpha` | system | File system operations, encryption routines, system modification |
| `system-service-beta` | system | Network connections, persistence, child process spawning |
| `system-service-gamma` | system | Credential store access, sensitive registry hive reads, data staging |
| `system-service-delta` | system | User activity monitoring, screen data capture, document scanning |
| `system-service-epsilon` | system | Deep persistence install, boot configuration changes, process injection |
| `system-service-lateral` | system | Network discovery, SMB enumeration, pass-the-hash, remote execution |

**Note:** Internal IDs are deliberately neutral. The UI displays friendly names from the same registry.

---

## Key Services

### Backend Services

| Service | Purpose |
|---------|---------|
| **SandboxRuntimeService** | Communicates with the FastAPI runtime API |
| **SandboxSyncService** | MongoDB session persistence |
| **AuthService** | JWT token management |
| **InvestigationService** | Case CRUD, status workflows |
| **EvidenceService** | File management, verification |
| **AIAnalysisService** | Threat classification |
| **BlockchainService** | Evidence verification |
| **HealthService** | Platform health monitoring |
| **QueueService** | Background job processing |
| **ResilienceService** | Circuit breakers, retry logic |

### Frontend Stores

| Store | Purpose |
|-------|---------|
| **sandboxStore** | Sandbox sessions, telemetry, logs, VM status |
| **authStore** | Authentication state |
| **investigationStore** | Investigation data |
| **alertStore** | Alert management |
| **evidenceStore** | Evidence management |
| **realtimeStore** | Live connection state |
| **themeStore** | Dark/light theme management |
| **blockchainStore** | Blockchain operations |
| **custodyStore** | Chain of custody |
| **threatStore** | Threat intelligence |

---

## VM Configuration

| Setting | Value |
|---------|-------|
| **VM Name** | ForensicsSandbox |
| **Chipset** | ICH9 |
| **OS** | Windows 11 EFI |
| **Username** | guestuser |
| **Password** | guest |
| **Snapshot** | CleanBaselinePython |
| **Guest Additions** | Required |
| **Headless Mode** | true (default for runtime) |

---

## Running the Project

Use the orchestrator at the repo root:

### Linux / macOS
```bash
./start-all.sh
```

### Windows
```powershell
.\start-all.ps1
```

Both launch backend → AI service → sandbox agent → frontend with health-check polling.

To run components individually:

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Sandbox Agent

```bash
cd sandbox-agent-v2
pip install -r requirements.txt
python3 main.py
```

### AI Service

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Sandbox Dashboard

- Navigate to Dashboard → Sandbox
- Click "Start Runtime" if the agent is offline
- Select a simulator from the dropdown
- Click "New Session" to begin analysis

---

## Session States

| State | Description |
|-------|-------------|
| `pending` | Session created, not started |
| `initializing` | Preparing environment |
| `restoring_snapshot` | Restoring clean snapshot |
| `booting_vm` | Starting VM |
| `executing` | Running simulator |
| `monitoring` | Collecting telemetry |
| `analyzing` | Processing results |
| `rolling_back` | Restoring snapshot |
| `completed` | Session finished successfully |
| `failed` | Session failed or terminated |

---

## Safety Features (Enforced)

- ✅ VM-only execution (marker validation)
- ✅ Runtime limits (max 300s default)
- ✅ Safe directory restrictions
- ✅ Synthetic data only
- ✅ Localhost-only networking
- ✅ Automatic rollback on completion or failure
- ✅ RBAC access control
- ✅ Input validation
- ✅ Enterprise security hardening

---

## API Endpoints Summary

### Core API

| Prefix | Description |
|--------|-------------|
| `/api/v1/auth` | Authentication |
| `/api/v1/users` | User management |
| `/api/v1/investigations` | Investigation CRUD |
| `/api/v1/evidence` | Evidence management |
| `/api/v1/sandbox` | Sandbox sync |
| `/api/v1/ai` | AI analysis |

### Blockchain API

| Prefix | Description |
|--------|-------------|
| `/api/v1/blockchain` | Blockchain operations |
| `/api/v1/custody` | Chain of custody |
| `/api/v1/threat` | Threat intelligence |

### Analytics & Operations

| Prefix | Description |
|--------|-------------|
| `/api/v1/analytics` | Behavioral analytics |
| `/api/v1/operations` | Operations & health |

---

## Environment Variables

```env
JWT_SECRET=<32-char-minimum>
JWT_REFRESH_SECRET=<32-char-minimum>
MONGODB_URI=mongodb://...
BLOCKCHAIN_ENABLED=false
SANDBOX_RUNTIME_URL=http://127.0.0.1:8765
SANDBOX_AGENT_SECRET=<shared-secret>
AI_SERVICE_ENABLED=false
AI_SERVICE_URL=http://localhost:8000
```

---

## Current Date

2026-05-29

(Last updated: Cleaned dead references after sandbox-agent-v2 migration)
