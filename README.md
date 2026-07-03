# NyxTrace

**AI-powered cybercrime digital forensics platform with blockchain-anchored evidence verification.**

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/Express.js-000000?style=flat&logo=express&logoColor=white" alt="Express.js"/>
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/Solidity-363636?style=flat&logo=solidity&logoColor=white" alt="Solidity"/>
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/Zustand-815C4A?style=flat&logo=react&logoColor=white" alt="Zustand"/>
  <img src="https://img.shields.io/badge/Ethers.js-3C3C3D?style=flat&logo=ethereum&logoColor=white" alt="Ethers.js"/>
</p>

<p align="center">
  <em>A full-stack cybersecurity platform for safe malware behavior simulation, forensic analysis, and blockchain-anchored evidence integrity.</em>
</p>

> This is a defensive / educational project. Simulators are non-destructive and only run inside a sandbox VM with hard rollback.

---

## Features

| Area | Description |
|------|-------------|
| Multi-Role Auth | OTP-based registration, JWT auth, 6 RBAC roles (super_admin to auditor) |
| Sandbox Simulation | VirtualBox-based headless sandbox with 6 safe behavioral simulators, WebSocket telemetry, auto snapshot rollback |
| AI Threat Analysis | FastAPI microservice for telemetry classification, anomaly detection, severity scoring, investigation summarization |
| Blockchain Evidence | Ethereum smart contract (Solidity) for evidence hash anchoring, tamper detection, on-chain audit trail |
| Forensic Dashboard | Real-time KPIs, threat intelligence graph (force-directed), MITRE ATT&CK matrix, AI analysis panels |
| Chain of Custody | Full custody timeline, integrity verification, tamper alerts with acknowledgment workflow |
| Analytics | Behavioral pattern analysis, session comparison, threat correlation, forensic reporting |
| Dark UI | Permanent dark theme with glass-morphism, CSS dot-grid texture, smooth animations throughout |

---

## UI Components & Animations

The frontend features a polished dark-themed UI with glass-morphism surfaces, animated transitions, and interactive data visualizations.

### Dashboard (EnhancedDashboardPage)

| Component | Description |
|---|---|
| **KPI Card Grid** | Live counters for investigations, alerts, sandbox sessions, threat intel. Glass-morphism cards with hover scale animation (Framer Motion) |
| **Alert Feed** | Real-time scrolling alert timeline with severity-coded left borders and slide-in animations |
| **Recent Sessions** | Session cards with animated status badges: running spinner, completed checkmark, failed shake |
| **Chart Panel** | Session trend area chart, alert distribution donut, investigation bar chart. Enter/exit fade transitions via Recharts |
| **Connection Banner** | Animated pulse indicator for backend/blockchain/AI health status |

### Authentication (LoginPage / RegisterPage)

| Component | Description |
|---|---|
| **Auth Card** | Centered glass-morphism card with backdrop blur, fade-in entrance animation |
| **OTP Input** | Auto-focus chaining across 6 digit inputs, real-time validation shake on wrong code |
| **Role Selector** | Animated radio cards with icon transitions |
| **Password Strength** | Progressive color bar (red to yellow to green) with animated requirement checklist |

### Sandbox (SandboxDashboardPage)

| Component | Description |
|---|---|
| **Session Timeline** | Animated Gantt-like timeline showing session stages: REVERT, STAGE, EXECUTE, OBSERVE |
| **Telemetry Stream** | Live WebSocket telemetry with fade-in data points, auto-scrolling log viewer |
| **Simulator Cards** | Expandable cards with start/stop controls, animated progress rings |
| **VM Status Badge** | Real-time VM state with pulsing indicators: running, reverting, offline |

### Evidence & Blockchain

| Component | Description |
|---|---|
| **Evidence Explorer** | Searchable evidence grid with drag-and-drop upload. Verify button triggers local + blockchain anchor in sequence |
| **Blockchain Ops Panel** | Three-tab panel (Sync, Worker Queue, Health) with 30s auto-polling, process queue controls |
| **Chain of Custody** | Timeline visualization with custody transfer nodes, tamper alert highlights with acknowledge flow |
| **Integrity Badges** | Per-evidence verification badges: SHA-256 Verified, Blockchain Anchored, Tampered warning |
| **Explorer Integration** | Transaction hash links to Etherscan or local Hardhat explorer |

### Threat Intelligence (ThreatIntelligencePage)

| Component | Description |
|---|---|
| **Force Graph** | D3.js force-directed graph of IOC relationships with zoom/pan, animated node transitions |
| **IOC Cards** | Categorized indicator cards (IP, domain, hash, registry) with severity color coding |
| **Threat Score** | Animated gauge showing overall threat level |

### AI Analysis (AIAnalysisPage)

| Component | Description |
|---|---|
| **Analysis Panel** | Session selector with real-time AI results, confidence bars, anomaly markers |
| **Summary Cards** | Auto-generated investigation summaries with expand/collapse animation |
| **Risk Gauge** | Animated severity indicator (critical to low) |

### Navigation & Layout

| Component | Description |
|---|---|
| **Sidebar** | Collapsible with micro-transitions, role-based menu items, active route highlight |
| **Header** | Breadcrumb trail, notification badge with pulse animation, search overlay |
| **Page Transitions** | Route changes use fade-slide transitions via Framer Motion AnimatePresence |
| **Glass Morphism** | CSS backdrop-filter: blur() and semi-transparent backgrounds on all panels and cards |
| **Dot-Grid Texture** | CSS-generated dot pattern overlay on page backgrounds |

---

## Architecture

```
                    +-------------------------------------------------------+
                    |               Frontend (React + TypeScript + Vite)      |
                    |   Pages | Stores (Zustand) | API client | WS client    |
                    |   Framer Motion | D3.js Force Graph | Recharts Charts  |
                    +---------------------------+---------------------------+
                        | REST /api/v1              ^ WebSocket (Socket.IO)
                        v                           |
+-------------------------------------------------------+
|              Backend API (Express.js + TypeScript)      |
|  Auth/RBAC | Investigations | Evidence | Sandbox | AI   |
|  Blockchain | Health | Queues | Tracing                  |
+-------+-------------------+------------------------------+
    | HTTP              | HTTP                  | MongoDB
    v                   v                       v
+-----------+   +------------------+   +-------------------+
| AI Service|   | Sandbox Agent   |   | MongoDB           |
| (FastAPI) |   | (FastAPI :8765) |   | (local :27017)    |
| Threat    |   | Pipeline + VBox |   | Investigations,   |
| Severity  |   | Telemetry WS    |   | evidence, alerts, |
| Anomalies |   | Logs WS         |   | sessions, IOCs    |
+-----------+   +-------+---------+   +-------------------+
                        | VBoxManage
                        v
              +----------------------+     +----------------------+
              | VirtualBox VM        |     | Ethereum Blockchain  |
              | ForensicsSandbox     |     | (Hardhat / Sepolia)  |
              | Snapshot:            |     | EvidenceRegistry.sol |
              |   CleanBaselinePython|     | Audit trail + State  |
              | Simulators run here  |     +----------------------+
              +----------------------+
```

### Technology Stack

| Layer | Tech |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Zustand, React Router, Framer Motion, Socket.IO client, D3.js, Recharts |
| **Backend** | Express.js, TypeScript, Mongoose, Socket.IO, Ethers.js, Winston, Helmet, express-rate-limit |
| **AI Service** | FastAPI, scikit-learn, pandas, uvicorn |
| **Sandbox Agent** | FastAPI, VirtualBox (VBoxManage), WebSocket streaming |
| **Blockchain** | Solidity 0.8.20, Hardhat, Ethers.js, Sepolia testnet / local Hardhat node |
| **Database** | MongoDB (local or Atlas) |
| **Auth** | JWT + refresh tokens, OTP via SMTP (Gmail app password), RBAC with 6 roles |

---

## Project Structure

```
nyxtrace/
|-- backend/                    Express.js API server (TypeScript)
|   |-- src/
|   |   |-- blockchain/         Ethereum integration (16 modules)
|   |   |   |-- smart-contract.service.ts     Contract interactions + state machine
|   |   |   |-- synchronization.service.ts    Sync queue + on-chain anchoring
|   |   |   |-- verification-orchestrator.service.ts  Coordinated verification
|   |   |   |-- verification-worker.service.ts        Parallel job queue
|   |   |   |-- verification.service.ts       Local integrity verification
|   |   |   |-- reconciliation.service.ts     DB vs blockchain reconciliation
|   |   |   |-- hashing.service.ts            SHA-256 fingerprinting + Merkle root
|   |   |   |-- transaction.service.ts        Tx lifecycle + confirmation monitoring
|   |   |   |-- state-tracking.service.ts     Health snapshots + metrics
|   |   |   |-- blockchain.service.ts         Web3 provider management
|   |   |   |-- config.ts                     Env-based configuration
|   |   |   |-- types.ts                      Enums + interfaces
|   |   |   |-- models/blockchain.model.ts    Mongoose schemas
|   |   |   |-- routes/blockchain.routes.ts   44 REST endpoints
|   |   |   +-- controllers/blockchain.controller.ts  Route handlers
|   |   |-- controllers/        Request handlers
|   |   |-- services/           Business logic, integrations
|   |   |   |-- evidence.service.ts           Upload + hashing
|   |   |   |-- health.service.ts             Aggregated health checks
|   |   |   |-- ai-analysis.service.ts        AI microservice integration
|   |   |   |-- websocket.service.ts          Socket.IO event bus
|   |   |   +-- ...
|   |   |-- routes/             REST routing
|   |   |-- middleware/         Auth, security, tracing, context
|   |   |-- models/             Mongoose schemas
|   |   +-- config/             Env + logger configuration
|   |
|-- frontend/                   React + TypeScript (Vite)
|   +-- src/
|       |-- pages/
|       |   |-- EnhancedDashboardPage           KPI cards, charts, alert feed
|       |   |-- EvidenceExplorerPage            Evidence grid + blockchain verify
|       |   |-- BlockchainOperationsPage        Sync/worker/health management
|       |   |-- ChainOfCustodyPage              Custody timeline + tamper alerts
|       |   |-- AIAnalysisPage                  AI classification + anomaly display
|       |   |-- ThreatIntelligencePage          D3 force graph + IOC browser
|       |   |-- ForensicAnalyticsPage           MITRE ATT&CK + correlation
|       |   |-- SandboxDashboardPage            Session management + telemetry
|       |   |-- LoginPage / RegisterPage        Auth with OTP flow
|       |   |-- SettingsPage                    User preferences
|       |   +-- ManifestoPage                   About / team
|       |-- stores/             Zustand state stores
|       |   |-- blockchainStore                 40+ actions (status, verify, sync, worker, reconciliation)
|       |   +-- evidenceStore                   Evidence CRUD + blockchain bridge
|       |-- components/
|       |   |-- blockchain/     BlockchainOperationsPanel, ReconciliationPanel
|       |   |-- layout/         Sidebar, Header, MainLayout
|       |   +-- ui/             GlassPanel, Badge, StatusIndicator, Charts
|       |-- services/api.ts     Typed API client
|       |-- config/             Env validation + tunable constants
|       +-- router/             React Router + role-gated routes (RoleRoute)
|
|-- blockchain/                 Smart contract development
|   |-- contracts/EvidenceRegistry.sol    Single combined contract (Solidity 0.8.20)
|   |-- test/EvidenceRegistry.test.ts     29 passing tests
|   |-- hardhat.config.ts                 Hardhat + Sepolia deployment
|   +-- scripts/deploy.ts                 Deployment script
|
|-- ai-service/                 FastAPI AI microservice (Python)
|   +-- app/                    Threat classification, severity, anomalies
|
|-- sandbox-agent-v2/           FastAPI sandbox runtime + simulators
|   |-- agent/                  Pipeline state machine, VM orchestration, telemetry
|   +-- simulators/             6 safe behavioral modules
|
|-- shared/                     Cross-service contracts + port config
|-- docs/                       Architecture notes + 9 runbooks
|-- .env.example                Sample environment config
+-- start-all.sh / start-all.ps1   Orchestrated startup
```

---

## Blockchain Module

The blockchain module anchors evidence integrity to an Ethereum smart contract:

### Smart Contract (EvidenceRegistry.sol)

- Single combined contract implementing both evidence registration and audit trail
- State machine: PENDING to REGISTERED to TRANSFERRED to LOCKED with validated transitions
- Batch registration for bulk evidence anchoring
- On-chain verification with hash comparison
- Tamper detection with immutable audit entries
- 29 passing tests covering register, verify, batch, state transitions, tamper detection

### Backend Services (16 modules)

| Service | Purpose |
|---|---|
| **config.ts** | Env-based configuration (RPC URL, contract address, chain ID, gas settings) |
| **blockchain.service.ts** | Web3 provider management, network info, gas estimation |
| **smart-contract.service.ts** | Contract read/write operations, state machine transitions, reconciliation |
| **synchronization.service.ts** | Background sync queue with 5s auto-processing for on-chain registration |
| **verification-orchestrator.service.ts** | Coordinates hashing, DB records, and blockchain anchoring |
| **verification-worker.service.ts** | Parallel verification job queue with priority scheduling |
| **verification.service.ts** | Local evidence integrity verification (hash comparison) |
| **hashing.service.ts** | SHA-256 fingerprinting, file integrity verification |
| **transaction.service.ts** | Transaction lifecycle, confirmation monitoring, retry |
| **reconciliation.service.ts** | Detects and auto-resolves DB vs blockchain inconsistencies |
| **state-tracking.service.ts** | Monitors operational state, health snapshots |

### API Endpoints (44 routes)

All under `/api/v1/blockchain`:

| Endpoint | Purpose |
|---|---|
| `GET /status` | Blockchain connection status + verification mode |
| `POST /evidence/register` | Register evidence hash on-chain |
| `POST /evidence/verify` | Verify evidence integrity against blockchain |
| `POST /evidence/batch-verify` | Batch verification |
| `GET /verification/stats` | Verification statistics |
| `GET /verification/history/:id` | Per-evidence verification history |
| `POST /contract/register` | Direct smart contract registration |
| `POST /contract/verify` | Direct smart contract verification |
| `GET /audit` | Audit log entries |
| `GET /audit/evidence/:id` | Evidence-specific audit trail |
| `GET /sync/status` | Sync queue status |
| `POST /sync/process` | Trigger queue processing |
| `GET /worker/status` | Worker statistics |
| `POST /worker/job` | Create verification job |
| `POST /reconciliation/run` | Trigger reconciliation |
| `GET /reconciliation/issues` | List reconciliation issues |
| `GET /reconciliation/stats` | Reconciliation statistics |
| `GET /state/health` | Health metrics |
| `GET /transactions` | Transaction history |
| `GET /tamper/alerts` | Tamper alert list |

---

## API Reference

### Auth & Users

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Create account (sends OTP) |
| POST | `/auth/send-otp` | public | Send / resend OTP |
| POST | `/auth/verify-otp` | public | Verify OTP, return tokens |
| POST | `/auth/login` | public | Email + password login |
| POST | `/auth/refresh` | public | Exchange refresh token |
| POST | `/auth/logout` | authenticated | Revoke refresh token |
| GET | `/auth/me` | authenticated | Current user profile |
| GET | `/users` | admin+ | List all users |
| PATCH | `/users/:id` | admin+ | Update user role / status |

### Investigations & Evidence

| Method | Path | Roles | Description |
|---|---|---|---|
| GET / POST | `/investigations` | analyst+ | List / create investigations |
| GET / PATCH / DELETE | `/investigations/:id` | analyst+ | CRUD by ID |
| GET | `/evidence` | analyst+ | List evidence |
| POST | `/evidence/upload` | analyst+ | Upload evidence file |
| POST | `/evidence/:id/verify` | analyst+ | Verify evidence integrity |

### Sandbox

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/sandbox/health` | auditor+ | Runtime health |
| GET | `/sandbox/simulators` | analyst+ | Simulator catalog |
| GET / POST | `/sandbox/sessions` | operator+ | List / start session |
| GET | `/sandbox/sessions/:id` | analyst+ | Session detail |
| POST | `/sandbox/sessions/:id/stop` | operator+ | Graceful stop |
| POST | `/sandbox/sessions/:id/terminate` | operator+ | Force terminate + rollback |
| POST | `/sandbox/vm/reset` | operator+ | Restore snapshot |
| GET | `/sandbox/vm/status` | analyst+ | VM state |

### Operations

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/operations/health` | public | Aggregated health |
| GET | `/operations/ready` | public | K8s readiness probe |
| GET | `/operations/live` | public | K8s liveness probe |
| GET | `/operations/metrics` | public | Prometheus metrics |

### Other

| Prefix | Purpose |
|---|---|
| `/api/v1/blockchain` | Evidence registration / verification |
| `/api/v1/custody` | Chain of custody |
| `/api/v1/threat` | Threat intelligence |
| `/api/v1/analytics` | Behavioral analytics |
| `/api/v1/alerts` | Alert management |
| `/api/v1/reports` | Forensic reports |
| `/api/v1/logs` | Audit log viewer |
| `/api/v1/ai` | AI analysis forward |
| `/api/v1/settings` | Application settings |

---

## Quick Start

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 18+ | Backend + frontend |
| npm | 9+ | Bundled with Node |
| Python | 3.11+ | AI service + sandbox agent |
| MongoDB | local or Atlas | Backend persistence |
| VirtualBox | 6.1+ | Only for sandbox execution |

### Linux / macOS

```bash
git clone <repo-url> nyxtrace
cd nyxtrace

# Backend
cd backend
npm install
cp .env.example .env    # fill MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET
npm run dev              # http://localhost:3000

# Frontend (new terminal)
cd frontend
npm install
npm run dev              # http://localhost:5173
```

### Windows

```powershell
cd backend
npm install
Copy-Item ..\.env.example .env
notepad .env
npm run dev

cd frontend
npm install
npm run dev
```

### Smart Contracts (optional)

```bash
cd blockchain
npm install
npx hardhat test         # 29 tests
npx hardhat node         # local node :8545
npx hardhat run scripts/deploy.ts --network localhost
```

---

## Simulators

The sandbox agent ships 6 safe educational simulators:

| Internal ID | Behavior |
|---|---|
| `system-service-alpha` | File system operations, encryption routines, system modification |
| `system-service-beta` | Network connections, persistence, child process spawning |
| `system-service-gamma` | Credential store access, sensitive registry reads, data staging |
| `system-service-delta` | User activity monitoring, screen data capture, document scanning |
| `system-service-epsilon` | Deep persistence install, boot configuration changes, process injection |
| `system-service-lateral` | Network discovery, SMB enumeration, pass-the-hash, remote execution |

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

---

## Observability

- **Aggregated health** at `/api/v1/operations/health` — per-service breakdown (database, websocket, queue, sandbox, AI, blockchain)
- **Prometheus metrics** at `/api/v1/operations/metrics?format=prometheus`
- **Correlation IDs** — X-Correlation-ID traces end-to-end across all services
- **Structured logs** — Winston JSON (backend), Python logging (sandbox)

---

## Useful URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000/api/v1 |
| Backend Health | http://localhost:3000/api/v1/operations/health |
| AI Service | http://localhost:8000 |
| Sandbox Agent | http://127.0.0.1:8765 |
| Telemetry WS | ws://127.0.0.1:8765/telemetry/live |
| Hardhat Node | http://127.0.0.1:8545 |

---

## Project Status

- Phase 1-3: Core platform (auth, investigations, evidence, sandbox, blockchain)
- Phase 3.5-3.7: Chain of custody, threat intelligence, forensic analytics
- Phase 4: Enterprise hardening (security middleware, health monitoring)
- Phase 5-6: Headless sandbox runtime, web dashboard
- Production hardening: code-splitting, env validation, correlation IDs, aggregated health

### Intentionally Not Included

- Docker images (local dev is the supported workflow)
- HttpOnly cookie auth (JWT in localStorage, migration planned)
- Full test coverage (scaffolding exists, follow-up project)

---

## Documentation

Operational and architectural details live in `docs/`:

- developer-environment.md
- execution-runbook.md (sandbox + rollback)
- operational-runbook.md
- deployment-runbook.md
- blockchain-operations-runbook.md
- threat-intelligence-runbook.md
- forensic-analytics-runbook.md
- vm-safety-runbook.md
- phase1-foundation.md

---

## License

MIT

## Disclaimer

This software is for educational and research purposes only. It simulates malware behavior in a controlled sandbox to teach forensic analysis. Use only on systems you own or are authorized to test.
