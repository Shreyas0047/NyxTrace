# NyxTrace

**AI-powered cybercrime digital forensics platform with blockchain-anchored evidence verification.**

NyxTrace is an educational cybersecurity platform for safe malware behavior simulation and forensic analysis. It runs simulators inside a controlled VirtualBox sandbox, captures telemetry in real time, classifies threats with an AI service, and anchors evidence integrity to a blockchain.

> ⚠️ **This is a defensive / educational project.** Simulators are non-destructive and only run inside a sandbox VM with hard rollback. The platform is not offensive security tooling.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Project Structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Quick Start](#quick-start)
5. [Detailed Setup](#detailed-setup)
   - [Backend](#1-backend-expressjs--typescript)
   - [Frontend](#2-frontend-react--vite)
   - [AI Service](#3-ai-service-fastapi)
   - [Sandbox Agent + VirtualBox VM](#4-sandbox-agent-fastapi--virtualbox-vm)
6. [Environment Variables](#environment-variables)
7. [Useful URLs](#useful-urls)
8. [Running the Stack](#running-the-stack)
9. [API Reference](#api-reference)
10. [Simulators](#simulators)
11. [Roles & Permissions (RBAC)](#roles--permissions-rbac)
12. [Observability](#observability)
13. [Troubleshooting](#troubleshooting)
14. [Development Workflow](#development-workflow)
15. [Project Status](#project-status)
16. [Documentation](#documentation)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                Frontend (React + TypeScript + Vite)                 │
│         Pages • Stores (Zustand) • API client • WS client           │
└─────────────────────────────────────────────────────────────────────┘
            │ REST  /api/v1                ▲ WebSocket (Socket.IO)
            ▼                              │
┌─────────────────────────────────────────────────────────────────────┐
│              Backend API (Express.js + TypeScript)                  │
│  Auth/RBAC • Investigations • Evidence • Sandbox • AI • Blockchain  │
│                  Health • Queues • Tracing                          │
└─────────────────────────────────────────────────────────────────────┘
        │ HTTP                 │ HTTP                  │ MongoDB
        ▼                      ▼                       ▼
┌───────────────┐   ┌──────────────────────┐   ┌───────────────────┐
│ AI Service    │   │ Sandbox Agent        │   │ MongoDB Atlas     │
│ (FastAPI)     │   │ (FastAPI :8765)      │   │ (cloud cluster)   │
│ Threat class. │   │ Pipeline + VBox mgr  │   │ Investigations,   │
│ Severity      │   │ Telemetry WS         │   │ evidence, alerts, │
│ Anomalies     │   │ Logs WS              │   │ sessions, IOCs    │
└───────────────┘   └─────────┬────────────┘   └───────────────────┘
                              │ VBoxManage
                              ▼
                    ┌──────────────────────┐
                    │ VirtualBox VM        │
                    │ ForensicsSandbox     │
                    │ Snapshot:            │
                    │   CleanBaselinePython│
                    │ Simulators run here  │
                    └──────────────────────┘
```

---

## Project Structure

```text
.
├── backend/                Express.js API server (TypeScript)
│   ├── src/
│   │   ├── controllers/    Request handlers
│   │   ├── services/       Business logic, integrations
│   │   ├── routes/         REST routing
│   │   ├── middleware/     Auth, security, tracing, request-context
│   │   ├── models/         Mongoose schemas
│   │   ├── blockchain/     Ethereum integration (Sepolia)
│   │   └── tests/          Jest tests
│   └── contracts/          ForensicsAudit.sol Solidity contract
│
├── frontend/               React + TypeScript (Vite)
│   └── src/
│       ├── pages/          Route components
│       ├── stores/         Zustand state stores
│       ├── services/       API + WebSocket clients
│       ├── components/     UI, layout, visualizations
│       ├── config/         Env + tunable constants (single source of truth)
│       └── router/         React Router definitions
│
├── ai-service/             FastAPI AI microservice (Python)
│   └── app/                Threat classification, severity, anomalies
│
├── sandbox-agent-v2/       FastAPI sandbox runtime + simulators
│   ├── main.py             Uvicorn entrypoint, listens on :8765
│   ├── agent/
│   │   ├── app.py          FastAPI routes + WebSocket broadcasters
│   │   ├── pipeline.py     Session state machine
│   │   ├── vm.py           VBoxManage orchestration
│   │   └── models.py       Pydantic schemas
│   └── simulators/         Six safe educational behavior modules
│
├── shared/                 Cross-service contracts + service-port config
│   ├── config/services.json
│   ├── contracts/
│   └── schemas/
│
├── docs/                   Architecture notes + runbooks
├── logs/                   Local agent + monitoring logs (gitignored)
├── start-all.ps1           PowerShell orchestrator (Windows)
├── .env.example            Sample environment config
├── CONTEXT.md              Internal context summary
└── README.md               This file
```

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | 18+ | Backend + frontend |
| **npm** | 9+ | Bundled with Node |
| **Python** | 3.11+ | AI service + sandbox agent (3.13 also works) |
| **MongoDB** | Atlas or self-hosted | Backend persistence |
| **VirtualBox** | 6.1+ | Optional — only for sandbox execution |
| **Git** | any recent | Cloning + version control |

Backend, frontend, and AI service work on any OS. The sandbox agent and orchestrator scripts support both Linux and Windows.

---

## Quick Start

For the impatient — gets you running with minimal config, no sandbox VM, no AI service.

### Linux / macOS
```bash
# 1. Clone and configure
git clone <repo-url> nyxtrace
cd nyxtrace
cp backend/.env.example backend/.env
nano backend/.env          # fill in MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET

# 2. Install & start MongoDB (Docker)
docker run -d -p 27017:27017 --name mongodb mongo:7

# 3. Start everything
npm install                # installs concurrently
./start-all.sh
```

### Windows
```powershell
# 1. Clone and configure
git clone <repo-url> nyxtrace
cd nyxtrace
Copy-Item .env.example backend\.env
notepad backend\.env   # fill in MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET

# 2. Backend
cd backend
npm install
npm run dev
# → http://localhost:3000/api/v1

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Open `http://localhost:5173`, register a user, sign in. The Sandbox and AI features will show as offline until you start their services (next section).

---

## Detailed Setup

### 1. Backend (Express.js + TypeScript)

```powershell
cd backend
npm install
Copy-Item ..\.env.example .env -ErrorAction SilentlyContinue
notepad .env
npm run dev
```

The backend listens on `http://localhost:3000` and serves the API at `/api/v1`.

**Required env values (minimum to boot):**

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/forensics_platform
JWT_SECRET=<at least 32 characters>
JWT_REFRESH_SECRET=<at least 32 characters>
```

**npm scripts:**

| Command | Description |
|---|---|
| `npm run dev` | TypeScript dev server with auto-reload (`ts-node-dev`) |
| `npm run build` | Compile TS → `dist/` |
| `npm start` | Run compiled `dist/index.js` |
| `npm run start:prod` | Run with `NODE_ENV=production` |
| `npm test` | Run Jest test suite |
| `npm run lint` | ESLint |
| `npm run db:init` | Initialize MongoDB indexes |
| `npm run db:seed` | Seed development data |

### 2. Frontend (React + Vite)

```powershell
cd frontend
npm install
npm run dev
```

Vite proxies `/api` → `http://localhost:3000` (see `vite.config.ts`), so the frontend talks to the backend without explicit URL configuration in development.

**Optional `.env` overrides:**

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_AI_SERVICE_URL=http://localhost:8000
VITE_APP_NAME=NyxTrace
VITE_APP_VERSION=2.0.0
```

The frontend validates these at boot via `src/config/index.ts` — invalid values fail fast in development and log loudly in production.

**npm scripts:**

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | Production build → `dist/` |
| `npm run build:check` | `tsc -b` + `vite build` (recommended for CI) |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | ESLint |

Heavy pages (`AIAnalysisPage`, `SandboxDashboardPage`, `LogsPage`, etc.) are code-split with `React.lazy` and load on demand.

### 3. AI Service (FastAPI)

Optional — required only when AI features (threat classification, anomaly detection, summaries) are used. Sets `AI_SERVICE_ENABLED=true` in the backend `.env` once running.

```powershell
cd ai-service
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The service listens on `http://localhost:8000` and exposes `/health`, `/api/v1/analyze/telemetry`, `/api/v1/enrich/alert`, `/api/v1/summarize/investigation`, `/api/v1/analyze/report`.

### 4. Sandbox Agent (FastAPI) + VirtualBox VM

Optional — required only when sandbox simulation features are used. Without it, the Sandbox dashboard shows the runtime as offline (the rest of the app works normally).

#### 4a. Create the sandbox VM

```powershell
# Adjust paths as needed
VBoxManage createvm --name "ForensicsSandbox" --ostype Windows10_64 --register
VBoxManage storagectl "ForensicsSandbox" --name "SATA" --add sata
VBoxManage storageattach "ForensicsSandbox" --storagectl "SATA" --port 0 --device 0 --type hdd --medium "C:\path\to\vm.vdi"
VBoxManage modifyvm "ForensicsSandbox" --memory 2048 --cpus 2 --nic1 nat --chipset ich9 --firmware efi
```

Inside the running VM:

1. Install **Guest Additions**.
2. Create the marker file `C:\sandbox\guest.marker` containing any text — its presence tells the agent the VM is approved for sandbox execution.

Once the VM is in a known-clean state, take the snapshot the agent reverts to before every session:

```powershell
VBoxManage snapshot "ForensicsSandbox" take "CleanBaselinePython"
```

You can override the VM and snapshot names via env (see [Environment Variables](#environment-variables)).

#### 4b. Run the agent

```powershell
cd sandbox-agent-v2
py -3.11 -m pip install -r requirements.txt
py -3.11 main.py
```

The agent listens on `http://127.0.0.1:8765`. WebSocket endpoints are at `/telemetry/live` and `/logs/live`.

The backend can also start the agent on demand via `POST /api/v1/sandbox/runtime/start` (admin only).

---

## Environment Variables

### Backend (`backend/.env`)

| Group | Variable | Default | Required | Notes |
|---|---|---|---|---|
| Server | `PORT` | `3000` | | |
| | `NODE_ENV` | `development` | | `development` \| `production` |
| | `API_VERSION` | `v1` | | |
| | `BASE_URL` | `http://localhost:3000` | | |
| Database | `MONGODB_URI` | — | ✅ | Mongo connection string |
| Auth | `JWT_SECRET` | — | ✅ | ≥32 chars |
| | `JWT_REFRESH_SECRET` | — | ✅ | ≥32 chars |
| | `JWT_EXPIRY` | `7d` | | |
| | `JWT_REFRESH_EXPIRY` | `30d` | | |
| Security | `CORS_ORIGIN` | `http://localhost:5173` | | Comma-separated |
| | `RATE_LIMIT_WINDOW_MS` | `900000` | | 15 minutes |
| | `RATE_LIMIT_MAX_REQUESTS` | `100` | | per IP |
| Uploads | `UPLOAD_MAX_SIZE` | `104857600` | | 100 MB |
| | `UPLOAD_DEST` | `./uploads` | | |
| | `EVIDENCE_PATH` | `./uploads/evidence` | | |
| | `REPORTS_PATH` | `./uploads/reports` | | |
| AI | `AI_SERVICE_ENABLED` | `false` | | |
| | `AI_SERVICE_URL` | `http://localhost:8000` | | |
| | `AI_SERVICE_TIMEOUT` | `60000` | | ms |
| Sandbox | `SANDBOX_RUNTIME_URL` | `http://127.0.0.1:8765` | | |
| | `SANDBOX_AGENT_SECRET` | — | | Shared secret for service-to-service auth |
| | `PYTHON_PATH` | system default | | Pin Python interpreter for `runtime/start` |
| Blockchain | `BLOCKCHAIN_ENABLED` | `false` | | |
| | `BLOCKCHAIN_NETWORK` | `sepolia` | | |
| | `BLOCKCHAIN_RPC_URL` | — | if enabled | |
| | `BLOCKCHAIN_CONTRACT_ADDRESS` | — | if enabled | |
| | `BLOCKCHAIN_CHAIN_ID` | `11155111` | | |
| Logging | `LOG_LEVEL` | `info` | | |
| | `LOG_FILE_PATH` | `./logs` | | |
| SMTP | `SMTP_HOST` | — | for OTP | e.g. `smtp.gmail.com` |
| | `SMTP_PORT` | `587` | | |
| | `SMTP_USER` / `SMTP_PASS` | — | for OTP | App password if Gmail |
| | `SMTP_FROM` | — | for OTP | |
| | `SMTP_TO` | — | optional | Override recipient for shared inboxes |

### Frontend (`frontend/.env`)

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_URL` | `/api/v1` | Falls through Vite proxy to the backend |
| `VITE_AI_SERVICE_URL` | `http://localhost:8000` | |
| `VITE_APP_NAME` | `NyxTrace` | |
| `VITE_APP_VERSION` | `2.0.0` | |

### Sandbox Agent (process env)

| Variable | Default | Notes |
|---|---|---|
| `SANDBOX_VM_NAME` | `ForensicsSandbox` | VirtualBox VM name |
| `SANDBOX_VM_SNAPSHOT` | `CleanBaselinePython` | Snapshot to revert to |
| `SANDBOX_GUEST_USER` | `guestuser` | VM login user |
| `SANDBOX_GUEST_PASS` | `guest` | VM login password |

---

## Useful URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API base | http://localhost:3000/api/v1 |
| Backend health | http://localhost:3000/api/v1/operations/health |
| Backend readiness | http://localhost:3000/api/v1/operations/ready |
| Backend liveness | http://localhost:3000/api/v1/operations/live |
| Backend metrics (Prometheus) | http://localhost:3000/api/v1/operations/metrics?format=prometheus |
| AI Service | http://localhost:8000 |
| AI Service health | http://localhost:8000/health |
| Sandbox Agent | http://127.0.0.1:8765 |
| Sandbox Agent health | http://127.0.0.1:8765/health |
| Telemetry WebSocket | ws://127.0.0.1:8765/telemetry/live |
| Logs WebSocket | ws://127.0.0.1:8765/logs/live |

---

## Running the Stack

### Cross-platform: orchestrated startup (Recommended)

Requires `npm install` at the root.

```bash
npm start
```

Launches backend, frontend, AI service, and sandbox agent in a single terminal using `concurrently`. This is the recommended way to run the stack on macOS/Linux, and a modern alternative for Windows users.

### Windows: legacy PowerShell orchestrator

```powershell
.\start-all.ps1
```

Launches backend → AI service → sandbox agent → frontend in dependency order with health-check polling. Each service runs in its own PowerShell window.

### Manual startup (any OS)

Open four terminals and run, in order:

```bash
# 1. Backend
cd backend && npm run dev

# 2. AI service (optional)
cd ai-service && uvicorn app.main:app --reload --port 8000

# 3. Sandbox agent (optional, Windows host)
cd sandbox-agent-v2 && py -3.11 main.py

# 4. Frontend
cd frontend && npm run dev
```

---

## API Reference

The backend exposes a versioned REST API at `/api/v1`. All routes except `/auth/*` and the public health endpoints require a Bearer JWT.

### Auth & Users

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Create account (sends OTP if SMTP configured) |
| POST | `/auth/send-otp` | public | Send / resend OTP |
| POST | `/auth/verify-otp` | public | Verify OTP and return tokens |
| POST | `/auth/login` | public | Email + password login |
| POST | `/auth/refresh` | public | Exchange refresh token |
| POST | `/auth/logout` | authenticated | Revoke refresh token |
| GET | `/auth/me` | authenticated | Current user profile |
| GET | `/users` | admin+ | List users |
| PATCH | `/users/:id` | admin+ | Update user role / status |

### Investigations & Evidence

| Method | Path | Roles | Description |
|---|---|---|---|
| GET / POST | `/investigations` | analyst+ | List, create |
| GET / PATCH / DELETE | `/investigations/:id` | analyst+ | CRUD by id |
| GET | `/evidence` | analyst+ | List evidence |
| POST | `/evidence` | analyst+ | Create evidence record |
| POST | `/sync/evidence/upload` | agent secret | Upload from sandbox agent |
| GET | `/evidence/artifacts` | analyst+ | Evidence artifacts |

### Sandbox

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/sandbox/health` | auditor+ | Runtime health |
| GET | `/sandbox/simulators` | analyst+ | Simulator catalog |
| GET / POST | `/sandbox/sessions` | operator+ | List, start session |
| GET | `/sandbox/sessions/:id` | analyst+ | Session detail |
| POST | `/sandbox/sessions/:id/stop` | operator+ | Graceful stop |
| POST | `/sandbox/sessions/:id/terminate` | operator+ | Force terminate + rollback |
| GET | `/sandbox/stats` | analyst+ | Session statistics |
| GET | `/sandbox/telemetry-url` | analyst+ | Telemetry WS URL |
| POST | `/sandbox/vm/reset` | operator+ | Restore to snapshot |
| GET | `/sandbox/vm/status` | analyst+ | VM state |
| POST | `/sandbox/runtime/start` | admin+ | Spawn the agent process |

### Operations

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/operations/health` | public | Aggregated health (DB, queues, sandbox, AI if enabled) |
| GET | `/operations/ready` | public | Kubernetes readiness probe |
| GET | `/operations/live` | public | Kubernetes liveness probe |
| GET | `/operations/metrics` | public | Metrics (JSON or Prometheus) |
| GET / POST | `/operations/workers` | admin+ | Queue worker stats / control |

### Other

| Prefix | Purpose |
|---|---|
| `/api/v1/ai` | Forward to AI service |
| `/api/v1/blockchain` | Evidence registration / verification |
| `/api/v1/custody` | Chain of custody |
| `/api/v1/threat` / `/threat-analysis` | Threat intelligence |
| `/api/v1/analytics` | Behavioral analytics |
| `/api/v1/alerts` | Alert management |
| `/api/v1/reports` | Forensic reports |
| `/api/v1/logs` | Audit log viewer |
| `/api/v1/settings` | Application settings |
| `/api/v1/analysis` | Analysis jobs |

WebSocket clients (Socket.IO) connect to the backend root URL and receive `telemetry:event`, `alert:new`, `sandbox:session_update`, `dashboard:stats_update`, etc.

### Sandbox Agent direct API (FastAPI)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Agent liveness + VM state |
| GET | `/simulators` | List of registered simulators |
| GET | `/sessions` | List sessions |
| POST | `/sessions/start` | Start a new session |
| GET | `/sessions/:id` | Session detail |
| GET | `/sessions/:id/events` | Session telemetry events |
| POST | `/sessions/:id/stop` | Graceful stop |
| POST | `/sessions/:id/terminate` | Force terminate |
| POST | `/vm/reset` | Restore to snapshot |
| GET | `/vm/status` | VM state |
| GET | `/monitoring/status` | Monitoring counters |
| GET | `/execution/status` | Execution history |
| GET | `/logs` | Buffered runtime logs |
| WS | `/telemetry/live` | Live telemetry stream |
| WS | `/logs/live` | Live log stream |

---

## Simulators

The agent ships six safe educational simulators in `sandbox-agent-v2/simulators/`. Their internal IDs are deliberately neutral — friendly names are shown in the UI.

| Internal ID | Behaviour |
|---|---|
| `system-service-alpha` | File system operations, encryption routines, system modification |
| `system-service-beta` | Network connections, persistence, child process spawning |
| `system-service-gamma` | Credential store access, sensitive registry hive reads, data staging |
| `system-service-delta` | User activity monitoring, screen data capture, document scanning |
| `system-service-epsilon` | Deep persistence install, boot configuration changes, process injection |
| `system-service-lateral` | Network discovery, SMB enumeration, pass-the-hash, remote execution |

All simulators write only to `C:\sandbox\` inside the VM, generate synthetic data, and rely on the pipeline's pre-and-post snapshot revert for rollback.

---

## Roles & Permissions (RBAC)

| Role | Typical use | Notable permissions |
|---|---|---|
| `super_admin` | Owner | Everything |
| `admin` | Platform operator | User management, runtime control, all read/write |
| `forensic_analyst` | Investigator | Investigations, evidence, alerts, sandbox execute |
| `security_reviewer` | Reviewer | Read-only across investigations, evidence, alerts |
| `sandbox_operator` | Sandbox console | Sandbox sessions only |
| `auditor` | Compliance | Audit logs, custody chain, read-only evidence |

Role gating is enforced both in API middleware (`authorize(...)`) and in the frontend router (`RoleRoute`).

---

## Observability

- **Aggregated health** at `/api/v1/operations/health` returns JSON with `status` (`healthy` / `degraded` / `down`) and per-service breakdown (`database`, `websocket`, `queue`, `sandboxAgent`, optionally `aiService` and `blockchain`).
- **Prometheus metrics** at `/api/v1/operations/metrics?format=prometheus`.
- **Correlation IDs** — every API request gets an `X-Correlation-ID` header. The frontend generates one with `crypto.randomUUID`; the backend echoes it on responses and forwards it to the sandbox agent so a single user action can be traced end-to-end across all three services.
- **Structured logs** — backend uses Winston JSON; sandbox agent uses Python `logging` (UTF-8 stdout). Logs are written under `logs/` (gitignored).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Backend exits with `JWT_SECRET must be at least 32 characters` | Short or missing secret | Generate longer secret in `.env` |
| Backend logs `MongoDB connection failed` | Bad URI, IP not allowlisted | Check Atlas network access list |
| Frontend health page shows backend offline | Backend not running, CORS wrong | Confirm `npm run dev` running, check `CORS_ORIGIN` |
| Sandbox dashboard shows agent offline | Agent not running | Click "Start Runtime" or run `py -3.11 main.py` in `sandbox-agent-v2/` |
| Session fails with "VM marker not found" | `C:\sandbox\guest.marker` missing inside VM | Create the marker file inside the guest |
| Snapshot restore fails | Snapshot name mismatch | Snapshot must be `CleanBaselinePython` (or override `SANDBOX_VM_SNAPSHOT`) |
| `VBoxManage not found` | VirtualBox not installed | Install VirtualBox 6.1+ |
| Sandbox agent port 8765 in use | Old process still running | `netstat -ano \| findstr :8765` then taskkill |
| Frontend type errors on build | Stale types | `npm run build:check` and address |
| OTP emails not sending | SMTP not configured | Fill SMTP_* in backend `.env`, use Gmail app password |

For sandbox-specific issues see `docs/runbooks/execution-runbook.md`.

---

## Development Workflow

### Code style

- TypeScript / JavaScript: 2-space indent, single quotes, trailing commas. Enforced by `.prettierrc` and `.editorconfig` at the repo root.
- Python: 4-space indent, PEP 8.

### Type checking

```powershell
# Backend
cd backend
npx tsc --noEmit

# Frontend (also runs build)
cd frontend
npm run build:check
```

### Linting

```powershell
cd backend && npm run lint
cd frontend && npm run lint
```

### Tests

```powershell
cd backend && npm test
```

The backend ships a Jest config; the frontend doesn't currently include component tests by default.

### Production builds

```powershell
cd backend && npm run build && npm run start:prod
cd frontend && npm run build:check
# Serve frontend/dist/ with any static host (nginx, S3+CloudFront, Netlify, etc.)
```

The frontend production bundle uses code-splitting (heavy pages lazy-loaded) and strips `console.log` / `debugger` calls. Sourcemaps are emitted so production stack traces can be deminified.

---

## Project Status

- **Phase 1–3:** Core platform with authentication, investigations, evidence, alerts, sandbox sessions ✅
- **Phase 3.5–3.7:** Chain of custody, threat intelligence, forensic analytics ✅
- **Phase 4:** Enterprise hardening — security middleware, resilience, health monitoring ✅
- **Phase 5–6:** Headless sandbox runtime, web dashboard ✅
- **Production hardening:** Code-splitting, env validation, correlation IDs, aggregated health, prettier/editorconfig ✅

### Intentionally not included

- **Docker images.** Local dev is the supported workflow; deployment images are out of scope for this educational build.
- **HttpOnly cookie auth.** JWTs currently sit in `localStorage`. Migrating to HttpOnly cookies is a deliberate follow-up.
- **Comprehensive test suite.** Test scaffolding exists; full unit / E2E coverage is a follow-up project.

---

## Documentation

Operational and architectural details live in `docs/`:

- `docs/runbooks/developer-environment.md` — local setup checklist
- `docs/runbooks/execution-runbook.md` — sandbox execution + rollback
- `docs/runbooks/operational-runbook.md` — production operations
- `docs/runbooks/deployment-runbook.md` — deployment guidance
- `docs/runbooks/blockchain-operations-runbook.md` — blockchain anchoring
- `docs/runbooks/threat-intelligence-runbook.md` — IOC + threat-intel pipeline
- `docs/runbooks/forensic-analytics-runbook.md` — analytics + correlation
- `docs/runbooks/vm-safety-runbook.md` — sandbox VM safety contract
- `docs/architecture/phase1-foundation.md` — initial architecture decisions
- `CONTEXT.md` — internal context summary

---

## License

MIT — see individual package metadata.

## Disclaimer

This software is for **educational and research purposes only**. It simulates malware behavior in a controlled sandbox to teach forensic analysis. It is not, and is not intended to be, a tool for unauthorized access, intrusion, or any offensive operation. Use only on systems you own or are authorized to test.
