# NyxTrace — Agent Guide

## Architecture

Four services, each in its own directory:

| Service | Dir | Stack | Port | Entrypoint |
|---------|-----|-------|------|------------|
| Backend | `backend/` | Express.js + Mongoose + Socket.io | 3000 | `src/index.ts` (ts-node-dev) |
| Frontend | `frontend/` | React 19 + Vite 8 + Tailwind v4 | 5173 | `src/main.tsx` |
| AI Service | `ai-service/` | FastAPI + Pydantic v2 | 8000 | `app/main.py` (uvicorn) |
| Blockchain | `blockchain/` | Hardhat + Solidity + ethers v6 | 8545 | `contracts/EvidenceRegistry.sol` |
| Sandbox Agent | `sandbox-agent-v2/` | Python + FastAPI + VirtualBox | 8765 | `main.py` |

## Startup

```bash
# Prerequisite: MongoDB must be running (local mongod or Atlas via MONGODB_URI)
./start-all.sh                     # launches all 4 services in order
SKIP_SANDBOX=1 ./start-all.sh     # skip any service
```

MongoDB connection retries 5× with 5s delay, then exits. Backend degrades gracefully without blockchain (Hardhat node) — falls to offline mode.

### Individual service commands

```bash
# Backend (hot-reload via ts-node-dev)
cd backend && npm run dev

# Frontend (Vite dev server, proxies /api → localhost:3000)
cd frontend && npm run dev

# AI Service
cd ai-service && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Hardhat node (must be running before blockchain features work)
cd blockchain && npx hardhat node
```

## Backend

- **Entry:** `src/index.ts` — loads dotenv from cwd, connects MongoDB, inits blockchain services, starts HTTP + WebSocket
- **Routes:** 19 route modules mounted under `/api/v1` in `src/routes/index.ts`
- **Auth:** JWT access + refresh tokens via `authStore` + `auth.routes.ts`; 6 RBAC roles (`super_admin`, `admin`, `forensic_analyst`, `investigator`, `viewer`, `auditor`)
- **Services:** 28 services in `src/services/` — key ones: `websocket.service.ts`, `blockchain/blockchain.service.ts`, `blockchain/synchronization.service.ts`, `blockchain/verification-worker.service.ts`
- **Models:** 13 Mongoose schemas in `src/models/`
- **Test:** Jest, tests live in `src/**/*.test.ts`. Run: `npm test --prefix backend`

## Frontend

- **Entry:** `src/main.tsx` → `App.tsx` → `router/AppRoutes.tsx`
- **Routes:** 24 pages (23 reactive + catch-all redirect). Pages split:
  - Eager: Dashboard, Investigations, Evidence, Alerts, etc. (17 direct imports)
  - Lazy-loaded: AIAnalysisPage, SandboxDashboardPage, LogsPage, InvestigationDetailPage, ReportsPage, EvidenceArtifactsPage, SystemHealthPage
- **State:** 16 Zustand stores in `src/stores/` — key: `authStore`, `blockchainStore`, `evidenceStore`, `sandboxStore`, `telemetryStore`
- **Styling:** Tailwind v4 (CSS-first config in `src/index.css` `@theme` block) + CSS custom properties. No CSS modules, no Sass. Design tokens also duplicated in `src/design-system/index.ts` (JS object used by some components)
- **Theme:** Force-dark via `ThemeProvider` — `themeStore` has light/dark but it's dead code. Pure black background with CSS dot-grid overlay via `body::before`
- **Config:** `src/config/index.ts` reads `VITE_API_URL`, `VITE_AI_SERVICE_URL`, `VITE_BLOCKCHAIN_EXPLORER_URL`, `VITE_APP_NAME`, `VITE_APP_VERSION`
- **API client:** `src/services/api.ts` (axios, ~900 lines) — normalizes `_id`→`id`, request dedup, retry logic
- **TypeScript quirks:** `verbatimModuleSyntax: true` — must use `import type` for type-only imports. `noUnusedLocals` and `noUnusedParameters` are on
- **Build:** `npm run build:check` runs `tsc -b` then `vite build`. `build:prod` strips console/debugger via Oxc
- **Vite proxy:** `/api` proxies to `http://localhost:3000` for dev

## AI Service

- **Entry:** `app/main.py` — 5 routers (health, analysis, enrich, summarize, report)
- **Routes:** `POST /api/v1/analyze/telemetry`, `POST /api/v1/analyze/report`, `POST /api/v1/enrich/alert`, `POST /api/v1/summarize/investigation`, `POST /api/v1/report/executive`
- **Config:** `.venv` for virtual env, `app/core/config.py` for settings via env vars
- **Core modules:** `app/modules/telemetry_analysis/`, `threat_classification/`, `severity_scoring/`, `anomaly_detection/`, `feature_extraction/`, `summarization/`, `forensic_pipeline.py`, `llm_integration.py`
- **Cache:** LRU in `app/core/cache.py` (configurable max_size=128, TTL=300s)
- **Rate limiter:** In-memory sliding window in `app/core/rate_limiter.py` (60 req/60s per IP)
- **LLM:** Optional — supports Ollama and OpenAI via `app/modules/llm_integration.py`. Non-blocking enhancement. Disabled by default (`AI_LLM_ENABLED=false`)
- **Test:** pytest with pytest-asyncio. Run: `cd ai-service && .venv/bin/python -m pytest app/tests/ -v`
- **CORS default:** `http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173`

## Blockchain

- **Contract:** `contracts/EvidenceRegistry.sol` — evidence hash anchoring, tamper detection
- **Network:** Local Hardhat node (chain ID 31337). Contract at `0x5FbDB2315678afecb367f032d93F642f64180aa3`. Signer: Hardhat account #0
- **Commands:** `npx hardhat compile`, `npx hardhat test`, `npx hardhat run scripts/deploy.ts --network <name>`
- **Build artifacts:** `artifacts/`, `cache/`, `typechain-types/` — all gitignored

## CI (`.github/workflows/ci.yml`)

Three parallel jobs on push/PR to main/master:
1. **Backend:** `npm ci`, `npm run build:check`, `npm test`
2. **Frontend:** `npm ci`, `npm run build:check` (typecheck + build)
3. **Python Services:** `pip install -r requirements.txt` + `compileall` for both ai-service and sandbox-agent-v2

## Non-obvious conventions

- **Commit style:** Conventional Commits (`feat:`, `fix:`, `chore:`, etc.) — see `CONTRIBUTING.md`
- **No Docker:** VirtualBox on bare metal prevents containerization
- **All styling is either Tailwind v4 utilities or CSS custom properties** in `src/index.css`. No styled-components, no emotion, no CSS modules
- **`cn()` utility** from `clsx` re-exported from `src/design-system/index.ts` is used everywhere for conditional class merging
- **Inline `style={{}}` with CSS var references** is used in some pages (especially `EnhancedDashboardPage`) — prefer Tailwind utilities for new code
- **Tailwind v4** uses `@theme` in CSS, not `tailwind.config.js`
- **Backend strictness is off** (`"strict": false, "noImplicitAny": false` in tsconfig)
- **Frontend strictness is on** (`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`)
- **Backend tests** are in `src/` next to source files (`*.test.ts`), not in a separate `tests/` dir
- **`RoleRoute` wrapper** in frontend router controls page-level access based on `allowedRoles` prop
- **`.env` files are gitignored**, only `*.env.example` is tracked via negated pattern in `.gitignore`


## Frontend and UI rules

- Treat frontend-design as the primary skill for visual implementation.
- Preserve all existing business logic, API calls and authentication flows.
- Use the project's existing framework and package manager.
- Use TypeScript when the project already supports it.
- Build reusable components rather than large monolithic page files.
- Use a consistent spacing, typography, radius and shadow system.
- Prefer a modern light interface unless the task says otherwise.
- Avoid excessive gradients, glassmorphism, oversized headings and random animations.
- Do not use placeholder statistics or fabricated content.
- Every page must work on mobile, tablet and desktop.
- Include hover, focus, loading, empty, disabled and error states.
- Respect keyboard navigation and accessible colour contrast.
- Reuse existing components before installing a new UI library.
- Do not add dependencies unless they provide clear value.
- Run the existing lint, type-check and build commands after changes.