# NyxTrace — Comprehensive Deep Scan Report

> Generated: 2026-07-24
> Scope: All 5 services + shared config + docs + CI

---

## 1. Project Overview

| Property | Value |
|----------|-------|
| Name | NyxTrace |
| Version | 2.0.0 |
| License | MIT |
| Services | 5 (backend, frontend, ai-service, blockchain, sandbox-agent-v2) |
| Total source files | ~350 |
| Total test cases | ~144 |
| Repository | GitHub (private) |

---

## 2. Backend Service (`backend/`)

### 2.1 Directory Structure

```
backend/src/
├── index.ts                     Entry point (ts-node-dev)
├── constants.ts
├── config/
│   ├── index.ts                 AppConfig from env vars
│   ├── database.ts              MongoDB connection manager (5 retries, 5s delay)
│   └── logger.ts                Winston — 4 loggers (default, audit, security, api)
├── types/
│   ├── index.ts                 Core types (UserRole, etc.)
│   └── reports.ts               Forensic report types
├── validation/
│   ├── schemas.ts               Joi schemas
│   └── analysis.schemas.ts
├── models/                      13 model files
│   ├── user.model.ts             User + bcrypt + RBAC
│   ├── evidence.model.ts
│   ├── investigation.model.ts
│   ├── alert.model.ts
│   ├── report.model.ts
│   ├── analysis-report.model.ts
│   ├── analytics.model.ts       3 schemas
│   ├── sandbox-session.model.ts
│   ├── audit-log.model.ts       Static .log() method
│   ├── telemetry-event.model.ts TTL 30d
│   ├── threat.model.ts          4 schemas (IOC, Correlation, Enrichment, Analytics)
│   ├── custody.model.ts         5 schemas
│   └── knowledge-article.model.ts
├── middleware/
│   ├── index.ts
│   ├── auth.middleware.ts        authenticate, authorize, requireMinRole, etc.
│   ├── error.middleware.ts       errorHandler, AppError classes
│   ├── security.middleware.ts    correlationId, rate limiters, sanitize
│   ├── tracing.middleware.ts     trace context, performance metrics
│   ├── validation.middleware.ts  validateBody/Query/Params
│   └── request-context.ts       AsyncLocalStorage
├── routes/                      22 modules
│   ├── index.ts                 Mounts all under /api/v1
│   ├── auth.routes.ts
│   ├── user.routes.ts
│   ├── investigation.routes.ts
│   ├── evidence.routes.ts
│   ├── sandbox.routes.ts
│   ├── sync.routes.ts
│   ├── ai.routes.ts
│   ├── custody.routes.ts
│   ├── threat.routes.ts
│   ├── analytics.routes.ts
│   ├── operations.routes.ts
│   ├── reports.routes.ts
│   ├── logs.routes.ts
│   ├── settings.routes.ts
│   ├── evidence-artifacts.routes.ts
│   ├── threat-analysis.routes.ts
│   ├── alerts.routes.ts
│   ├── analysis.routes.ts
│   ├── knowledge.routes.ts
│   ├── roles.routes.ts
│   ├── config.routes.ts
│   └── blockchain/routes/blockchain.routes.ts  44 endpoints
├── controllers/                 21 files
│   ├── index.ts                 Exports 16
│   ├── auth.controller.ts
│   ├── user.controller.ts
│   ├── investigation.controller.ts
│   ├── evidence.controller.ts
│   ├── sandbox.controller.ts
│   ├── sync.controller.ts
│   ├── ai-analysis.controller.ts
│   ├── threat-analysis.controller.ts
│   ├── reports.controller.ts
│   ├── logs.controller.ts
│   ├── settings.controller.ts
│   ├── evidence-artifacts.controller.ts
│   ├── analysis.controller.ts
│   ├── knowledge.controller.ts
│   ├── roles.controller.ts
│   ├── config.controller.ts
│   ├── analytics.controller.ts   NOT in index
│   ├── alerts.controller.ts      NOT in index
│   ├── threat.controller.ts      NOT in index
│   └── custody.controller.ts     NOT in index
├── services/
│   ├── index.ts                 Exports 19 service singletons
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── investigation.service.ts
│   ├── evidence.service.ts
│   ├── evidence-validation.service.ts
│   ├── evidence-artifacts.service.ts
│   ├── investigation-correlation.service.ts   NOT in index
│   ├── sandbox-sync.service.ts
│   ├── sandbox-runtime.service.ts
│   ├── forensic-ingestion.service.ts
│   ├── telemetry-ingestion.service.ts
│   ├── sync-storage.service.ts
│   ├── ai-analysis.service.ts
│   ├── analysis.service.ts
│   ├── analysis-router.service.ts
│   ├── reports.service.ts
│   ├── logs.service.ts
│   ├── settings.service.ts
│   ├── websocket.service.ts     NOT in index
│   ├── health.service.ts        NOT in index
│   ├── queue.service.ts         NOT in index
│   ├── otp.service.ts           NOT in index
│   ├── resilience.service.ts    NOT in index
│   ├── behavioral-analytics.service.ts  NOT in index
│   ├── config.service.ts
│   ├── custody.service.ts       NOT in index
│   ├── database-optimization.service.ts  NOT in index
│   ├── knowledge.service.ts
│   └── threat-intelligence.service.ts    NOT in index
├── blockchain/                  12 files
│   ├── index.ts
│   ├── config.ts
│   ├── types.ts
│   ├── blockchain.service.ts    Web3 provider (ethers.js)
│   ├── hashing.service.ts       SHA-256, Merkle root
│   ├── smart-contract.service.ts  Two ABIs, 647 lines
│   ├── verification.service.ts
│   ├── verification-orchestrator.service.ts
│   ├── verification-worker.service.ts
│   ├── synchronization.service.ts
│   ├── transaction.service.ts
│   ├── reconciliation.service.ts
│   ├── state-tracking.service.ts
│   ├── models/blockchain.model.ts  5 schemas
│   ├── controllers/blockchain.controller.ts  1404 lines
│   └── routes/blockchain.routes.ts  44 endpoints
├── tests/
│   ├── health.test.ts           4 tests
│   ├── auth.test.ts             12 tests
│   ├── blockchain.test.ts       ~18 tests
│   ├── blockchain-services.test.ts  ~18 tests
│   ├── integration.test.ts      ~35 tests
│   └── request-context.test.ts  4 tests
├── scripts/
│   └── seed.ts                  Unlock locked user accounts (NOT init-db.ts or migrate.ts)
├── document_analysis/           4 files
├── ioc_extraction/              3 files
├── url_intelligence/            3 files
└── threat_intelligence/         13 files
```

### 2.2 Issues Found

| # | Severity | Issue | File |
|---|----------|-------|------|
| 1 | Medium | `db:init` script referenced in package.json does not exist | `package.json` script `db:init` |
| 2 | Medium | `db:migrate` script referenced in package.json does not exist | `package.json` script `migrate` |
| 3 | Low | 4 controllers imported directly instead of through `controllers/index.ts` | analytics.controller.ts, alerts.controller.ts, threat.controller.ts, custody.controller.ts |
| 4 | Low | 11 services not exported from `services/index.ts` | investigation-correlation, resilience, behavioral-analytics, custody, threat-intelligence, websocket, health, queue, otp, database-optimization |
| 5 | Low | `chainOfCustody` duplicated — embedded in evidence.model.ts and first-class in custody.model.ts | evidence.model.ts, custody.model.ts |
| 6 | Low | Type enums duplicated in `types/index.ts` and model files with different values | types/index.ts vs model files |
| 7 | Low | `blockchain.routes.ts` uses plain strings for roles instead of UserRole enum | blockchain.routes.ts |
| 8 | Low | `analysis.routes.ts` uses `.catch(next)` pattern instead of `asyncHandler` | analysis.routes.ts |

---

## 3. Frontend Service (`frontend/`)

### 3.1 Directory Structure

```
frontend/src/
├── main.tsx                     Entry point
├── index.css                    Tailwind v4 + CSS custom properties
├── config/
│   └── index.ts                 VITE_* env vars + runtime config
├── types/
│   ├── index.ts                 677 lines
│   ├── blockchain.ts            185 lines
│   └── reports.ts               201 lines
├── services/
│   ├── api.ts                   953 lines — Axios client with retry/dedup/normalization
│   ├── api.test.ts              65 lines
│   └── socket.ts                372 lines — Socket.IO client
├── stores/                      16 Zustand stores
│   ├── authStore.ts
│   ├── authStore.test.ts
│   ├── blockchainStore.ts       918 lines — 40+ actions
│   ├── evidenceStore.ts
│   ├── investigationStore.ts
│   ├── alertStore.ts
│   ├── sandboxStore.ts          354 lines
│   ├── telemetryStore.ts
│   ├── analysisStore.ts
│   ├── reportsStore.ts
│   ├── logsStore.ts
│   ├── realtimeStore.ts
│   ├── threatIntelStore.ts
│   ├── timelineStore.ts
│   ├── themeStore.ts            DEAD CODE — always dark
│   ├── statusStore.ts
│   └── settingsStore.ts
├── router/
│   ├── AppRoutes.tsx            297 lines, createBrowserRouter
│   └── RoleRoute.test.tsx
├── layouts/
│   ├── MainLayout.tsx
│   └── PageContainer.tsx
├── components/
│   ├── ErrorBoundary.tsx
│   ├── DotMatrixBackground.tsx   Three.js animated background
│   ├── PublicLayout.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx          250 lines
│   │   ├── Header.tsx           308 lines
│   │   └── ConnectionStatus.tsx
│   ├── ui/
│   │   ├── Button.tsx           110 lines
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   └── StatusBanner.tsx
│   ├── enterprise/
│   │   └── DashboardGrid.tsx    248 lines
│   ├── blockchain/
│   │   ├── BlockchainOperationsPanel.tsx  420 lines
│   │   └── ReconciliationPanel.tsx        255 lines
│   ├── threat-intelligence/
│   │   ├── AnalysisResultCard.tsx          293 lines
│   │   ├── ThreatSummaryBar.tsx            167 lines
│   │   ├── IocPanel.tsx                    345 lines
│   │   ├── UrlAnalysisView.tsx             1016 lines
│   │   └── DocumentAnalysisView.tsx        1027 lines
│   └── visualizations/
│       ├── index.ts
│       ├── MITREHeatmap.tsx                 303 lines
│       ├── AttackChain.tsx                  338 lines
│       ├── EvidenceGraph.tsx                504 lines
│       └── RiskScoreGauge.tsx               167 lines
├── pages/                       24 pages
│   ├── LoginPage.tsx            155 lines
│   ├── LoginPage.test.tsx       33 lines
│   ├── RegisterPage.tsx         361 lines
│   ├── ForgotPasswordPage.tsx   386 lines
│   ├── ManifestoPage.tsx        121 lines
│   ├── DiscoverPage.tsx         163 lines
│   ├── EnhancedDashboardPage.tsx 460 lines
│   ├── InvestigationsPage.tsx   322 lines
│   ├── InvestigationDetailPage.tsx 488 lines
│   ├── EvidenceExplorerPage.tsx 361 lines
│   ├── EvidenceArtifactsPage.tsx 417 lines
│   ├── AlertsPage.tsx           305 lines
│   ├── LiveTelemetryPage.tsx    258 lines
│   ├── AIAnalysisPage.tsx       1513 lines
│   ├── SandboxDashboardPage.tsx 1274 lines
│   ├── ReportsPage.tsx          414 lines
│   ├── LogsPage.tsx             630 lines
│   ├── BlockchainOperationsPage.tsx 67 lines
│   ├── ChainOfCustodyPage.tsx   241 lines
│   ├── ThreatIntelligencePage.tsx 321 lines
│   ├── ForensicAnalyticsPage.tsx 227 lines
│   ├── UsersPage.tsx            426 lines
│   ├── UserDossierPage.tsx      340 lines
│   ├── RoleAssignmentPage.tsx   269 lines
│   ├── SystemHealthPage.tsx     443 lines
│   ├── SystemConfigurationPage.tsx 296 lines
│   ├── SettingsPage.tsx         425 lines
│   └── KnowledgeBasePage.tsx    181 lines
├── providers/
│   └── ThemeProvider.tsx        Force-dark
├── hooks/
│   └── useDebounce.ts           23 lines
├── rbac/
│   └── index.ts                 132 lines — only defines 2 of 6 roles
├── utils/
│   └── helpers.ts               105 lines
├── design-system/
│   └── index.ts                 300 lines — JS design tokens + cn()
└── test/
    └── setup.ts
```

### 3.2 Issues Found

| # | Severity | Issue | File |
|---|----------|-------|------|
| 1 | Low | `themeStore` is dead code — app is force-dark, store never imported | stores/themeStore.ts |
| 2 | Low | Duplicate `formatDate()`/`formatRelativeTime()` implementations with different behavior | design-system/index.ts + utils/helpers.ts |
| 3 | Low | `rbac/index.ts` only defines 2 roles (ADMIN, FORENSIC_ANALYST) — backend supports 6 | rbac/index.ts |
| 4 | Low | Several stores forget to set `isLoading: false` in catch blocks | evidenceStore, investigationStore, logsStore |
| 5 | Low | `public/` directory is empty — no favicon, manifest, or static assets | public/ |
| 6 | Info | `Modal.tsx` hardcodes light-mode bg classes (`bg-white dark:bg-slate-800`) — dead weight since app is force-dark | components/ui/Modal.tsx |
| 7 | Info | `Toast.tsx` uses `crypto.randomUUID()` without fallback | components/ui/Toast.tsx |
| 8 | Info | `MainLayout.tsx` missing breadcrumb entries for 7 routes | layouts/MainLayout.tsx |

---

## 4. AI Service (`ai-service/`)

### 4.1 Directory Structure

```
ai-service/app/
├── __init__.py
├── main.py                      79 lines — FastAPI app, 5 routers
├── logging_config.py            59 lines — JSON formatter
├── tracing.py                   23 lines — ContextVar correlation ID
├── core/
│   ├── __init__.py
│   ├── config.py                76 lines — AIServiceConfig from env
│   ├── cache.py                 62 lines — LRU cache (OrderedDict)
│   ├── models.py                151 lines — Pydantic v2 models
│   └── rate_limiter.py          74 lines — Sliding window (60 req/60s)
├── routes/
│   ├── __init__.py              (empty)
│   ├── health.py                34 lines
│   ├── analysis.py              303 lines
│   ├── enrich.py                137 lines
│   ├── summarize.py             135 lines
│   └── report.py                150 lines
├── modules/
│   ├── __init__.py
│   ├── forensic_pipeline.py     384 lines — MITRE mapping, attack chain, anti-forensics, stealth rating
│   ├── llm_integration.py       115 lines — Legacy LLM (Ollama/OpenAI)
│   ├── llm_router.py            296 lines — Primary LLM path (dual-gated)
│   ├── anomaly_detection/
│   │   ├── __init__.py
│   │   └── detector.py          209 lines — Z-score + behavioral + process + network
│   ├── feature_extraction/
│   │   ├── __init__.py
│   │   └── extractor.py         254 lines — Process/file/registry/network with fuzzy matching
│   ├── severity_scoring/
│   │   ├── __init__.py
│   │   └── scorer.py            246 lines — Weighted scoring + threat boosts
│   ├── summarization/
│   │   ├── __init__.py
│   │   └── summarizer.py        288 lines — Executive/analyst/key findings/recommendations
│   ├── telemetry_analysis/
│   │   ├── __init__.py
│   │   └── analyzer.py          181 lines — Pipeline orchestrator (5 stages)
│   └── threat_classification/
│       ├── __init__.py
│       └── classifier.py        180 lines — 10 categories, rule-based
└── tests/
    ├── __init__.py               (empty)
    ├── test_health.py            34 lines — 2 tests
    ├── test_analysis.py          228 lines — 12 tests
    └── test_modules.py           126 lines — 11 tests
```

### 4.2 Issues Found

| # | Severity | Issue | File |
|---|----------|-------|------|
| 1 | High | Rate limiter `cleanup()` never called — stale IP entries accumulate indefinitely | `rate_limiter.py:cleanup()` |
| 2 | High | Rate limiter `.check()` returns `(True, 0)` on every call — never records timestamps, rate limiting is non-functional | `rate_limiter.py:check()` vs `is_allowed()` |
| 3 | Medium | Analysis route chunking logic creates sub-sampled list but never uses it | `analysis.py:76-84` |
| 4 | Medium | Cache key hashes only first 10 events — collisions possible with different full event sets | `cache.py` |
| 5 | Low | No test coverage for LLM router, forensic_pipeline, or any individual analysis module | `tests/` |
| 6 | Low | LLM retry sends identical prompt — no variation for second attempt | `llm_router.py:282-283` |
| 7 | Low | `pydantic-settings` in requirements.txt but never imported | `requirements.txt` |
| 8 | Low | `ForensicReportRequest` uses `.get()` instead of attribute access — bypasses Pydantic validation | `enrich.py`, `summarize.py` |

---

## 5. Blockchain (`blockchain/`)

### 5.1 Directory Structure

```
blockchain/
├── contracts/
│   └── EvidenceRegistry.sol     538 lines
├── test/
│   └── EvidenceRegistry.test.ts 307 lines, 24 test cases
├── scripts/
│   └── deploy.ts                14 lines
├── hardhat.config.ts            31 lines
├── package.json
├── tsconfig.json
├── artifacts/                   gitignored
├── cache/                       gitignored
└── typechain-types/             gitignored
```

### 5.2 Contract Details

- **Solidity version:** 0.8.20 with optimizer (200 runs)
- **State machine:** 4 states with enforced transitions, `markEvidenceInvalid()` bypass
- **Events:** 9 — EvidenceRegistered, EvidenceVerified, VerificationFailed, EvidenceStatusUpdated, AuditEntryCreated, CriticalAuditEvent, VerificationAuditEvent, EvidenceAuditEvent
- **Tests:** 24 passing (6 describe blocks: contract info, registration, verification, state transitions, audit, evidence listing)
- **Networks:** Hardhat local (chain ID 31337), Sepolia testnet

### 5.3 Issues Found

None — the blockchain module is clean, well-tested, and well-structured.

---

## 6. Sandbox Agent (`sandbox-agent-v2/`)

### 6.1 Directory Structure

```
sandbox-agent-v2/
├── main.py                      44 lines
├── requirements.txt             6 lines
├── agent/
│   ├── __init__.py              v2.0.0
│   ├── app.py                   367 lines — FastAPI, 14 HTTP + 2 WS endpoints
│   ├── models.py                129 lines — Pydantic v2
│   ├── config.py                22 lines — Settings from env
│   ├── vm.py                    348 lines — VBoxManage wrapper
│   ├── pipeline.py              403 lines — REVERT→BOOT→STAGE→EXECUTE→OBSERVE→COMPLETE
│   ├── security.py              59 lines — API key + resource limits
│   ├── tracing.py               24 lines — ContextVar
│   └── logging_config.py        66 lines — JSON formatter
└── simulators/
    ├── telemetry_helper.py      340 lines — Core engine
    ├── naming_helper.py         217 lines — Realistic naming + timing
    ├── c2_helper.py             160 lines — C2 beaconing
    ├── defense_helper.py        160 lines — Basic defense + discovery
    ├── persistence_helper.py    63 lines  — 5 persistence techniques
    ├── obfuscation_helper.py    83 lines  — XOR/Base64/RC4
    ├── discovery_helper.py      181 lines — 9 discovery depth emitters
    ├── defense_evasion_helper.py 192 lines — 9 defense evasion depth emitters
    ├── execution_helper.py      161 lines — 9 LOLBin execution emitters
    ├── collection_helper.py     165 lines — 7 collection depth emitters
    ├── impact_helper.py         142 lines — 6 impact emitters
    ├── ransomware_sim.py        315 lines — 18 phases
    ├── botnet_sim.py            297 lines — 17 phases
    ├── credential_stealer_sim.py 283 lines — 16 phases
    ├── sim_delta.py             210 lines — 16 phases
    ├── sim_epsilon.py           377 lines — 16 phases
    └── sim_lateral.py           275 lines — 17 phases
```

### 6.2 Issues Found

| # | Severity | Issue | File |
|---|----------|-------|------|
| 1 | High | Zero test files exist — no pytest, no unittest, nothing | `sandbox-agent-v2/` |
| 2 | Critical | `sim_lateral.py` references `target_ip` before assignment — `NameError` at runtime | `sim_lateral.py:69` |
| 3 | Medium | Hardcoded Python path `C:\Users\guestuser\AppData\Local\Programs\Python\Python313\python.exe` — version-specific | `pipeline.py:167` |
| 4 | Low | `ransomware_sim.py` `AES256` class is XOR, not AES — misleading name | `ransomware_sim.py` |
| 5 | Low | No graceful VM shutdown — uses `taskkill /f` or `pkill -9` | `pipeline.py` / `vm.py` |

---

## 7. Shared, Docs, CI, Config

### 7.1 Shared Config

| File | Purpose |
|------|---------|
| `shared/config/services.json` | Service registry with host/port/URL for all 4 services + startup order |
| `shared/schemas/forensic-report.schema.json` | Draft 2020-12 JSON Schema for forensic reports |
| `shared/contracts/simulator-manifest.schema.json` | Draft 2020-12 JSON Schema for simulator registration |

### 7.2 Documentation (`docs/`)

| File | Lines | Coverage |
|------|-------|----------|
| `docs/architecture/blockchain-evidence-verification.md` | 256 | Full blockchain verification architecture |
| `docs/architecture/smart-contracts-evidence-verification.md` | 246 | Smart contract infrastructure + ABIs |
| `docs/runbooks/blockchain-operations-runbook.md` | 271 | Sync, workers, reconciliation, state tracking |
| `docs/runbooks/threat-intelligence-runbook.md` | 312 | IOC management, correlation, operational procedures |
| `docs/runbooks/forensic-analytics-runbook.md` | 316 | Behavioral analytics, anomaly detection, clustering |
| `docs/runbooks/execution-runbook.md` | 228 | VirtualBox setup, sandbox execution |
| `docs/runbooks/operational-runbook.md` | 161 | Local operations, troubleshooting |
| `docs/runbooks/deployment-runbook.md` | 109 | Local deployment guide |
| `docs/runbooks/developer-environment.md` | 20 | Prerequisites and setup |
| `docs/screenshot.png` | - | Dashboard screenshot |

### 7.3 CI (`.github/workflows/ci.yml`)

4 parallel jobs on push/PR to main/master:
1. **Backend:** `npm ci`, lint, `build:check`, `npm test`
2. **Frontend:** `npm ci`, lint, `build:check` (typecheck + build)
3. **Blockchain:** `npm ci`, compile, `hardhat test`
4. **Python:** Install deps (ai-service + sandbox-agent), `ruff check` + `bandit`, `compileall`

### 7.4 GitHub Templates

- `PULL_REQUEST_TEMPLATE.md` — Description, type, testing checklist, general checklist
- `ISSUE_TEMPLATE/bug_report.md` — Bug report with reproduction steps
- `ISSUE_TEMPLATE/feature_request.md` — Feature request with problem/solution
- `ISSUE_TEMPLATE/config.yml` — Security advisory link
- `CODEOWNERS` — All owned by `@anomalyco`

---

## 8. Aggregate Metrics

### 8.1 Code Quality

| Check | Status |
|-------|--------|
| Backend `build:check` (tsc --noEmit) | Unknown |
| Frontend `build:check` (tsc -b) | Unknown |
| Python `compileall` | Clean (simulators/) |
| CI workflow | Configured but not verified |

### 8.2 Service Health Matrix

| Service | Test Count | Test Framework | CI Coverage | Known Runtime Issues |
|---------|-----------|----------------|-------------|---------------------|
| Backend | ~91 | Jest | ✅ | Port conflict on re-launch |
| Frontend | 4 | Vitest | ✅ | None |
| AI Service | 25 | pytest | ✅ | Rate limiting non-functional |
| Blockchain | 24 | Hardhat + Chai | ✅ | None |
| Sandbox Agent | 0 | None | ❌ | `target_ip` NameError, hardcoded Python path |

### 8.3 Issues Summary

| Severity | Count | Details |
|----------|-------|---------|
| Critical | 1 | `sim_lateral.py:69` — NameError at runtime (`target_ip` before assignment) |
| High | 3 | Rate limiter non-functional, cleanup leak, sandbox zero tests |
| Medium | 3 | Cache key collision risk, chunking dead code, hardcoded Python path |
| Low | 15 | Missing scripts, dead code, duplicate implementations, import inconsistency, missing favicon |

---

## 9. Key Recommendations

### Must Fix (Runtime Errors)
1. **`sim_lateral.py:69`** — `target_ip` referenced before assignment. Move the `emit_wmi_execution` call after the variable is assigned, or use a default value.
2. **Rate limiter** — Either remove the non-functional rate limiter or fix it by calling `is_allowed()` instead of `check()` and scheduling periodic `cleanup()`.

### Should Fix (Quality of Life)
3. **Sandbox tests** — Add `pytest` to `requirements.txt` and write basic unit tests for the simulators and pipeline.
4. **Backend scripts** — Either create `init-db.ts` and `migrate.ts` or remove them from `package.json`.

### Nice to Fix (Cleanup)
5. **Frontend dead code** — Remove `themeStore.ts` since the app is permanently dark.
6. **Controller/service index** — Either export the missing controllers/services from `index.ts` or remove them from the index if direct import is intentional.
7. **Frontend `public/`** — Add at least a favicon and `site.webmanifest`.

---

*End of deep scan report*
