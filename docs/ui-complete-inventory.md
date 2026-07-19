# NyxTrace UI Complete Inventory

> Canonical reference for every screen, component, form, store, workflow, API endpoint, and role gate in the frontend.
> Generated 2026-07-19 via exhaustive source-code audit. Target: 100% Stitch design coverage.

---

## Table of Contents

1. [Route Inventory](#1-route-inventory)
2. [Screen Inventory](#2-screen-inventory)
3. [Component Inventory](#3-component-inventory)
4. [Form Inventory](#4-form-inventory)
5. [State Inventory](#5-state-inventory)
6. [Workflow Inventory](#6-workflow-inventory)
7. [Role-Access Matrix](#7-role-access-matrix)
8. [Coverage Identifiers](#8-coverage-identifiers)

---

## 1. Route Inventory

### Configuration
- **Router:** `react-router-dom` v6 `createBrowserRouter`
- **Layout engine:** `MainLayout` with `Sidebar` + `Header` + `<Outlet />`
- **Loading:** `Suspense` with `Loader2` spinner for lazy pages
- **Transitions:** `AnimatePresence` mode="wait" with 250ms fade

### 1A — Public Routes (no auth required, no layout)

| # | Path | Component | Wrapper | Access |
|---|------|-----------|---------|--------|
| R01 | `/login` | `LoginPage` | `PublicRoute` | Anonymous |
| R02 | `/register` | `RegisterPage` | `PublicRoute` | Anonymous |
| R03 | `/forgot-password` | `ForgotPasswordPage` | `PublicRoute` | Anonymous |
| R04 | `/manifesto` | `ManifestoPage` | None | Anonymous |
| R05 | `/discover` | `DiscoverPage` | None | Anonymous |

### 1B — Authenticated Routes (any role, inside MainLayout)

| # | Path | Component | Load Strategy |
|---|------|-----------|---------------|
| R06 | `/dashboard` | `EnhancedDashboardPage` | Eager |
| R07 | `/investigations` | `InvestigationsPage` | Eager |
| R08 | `/investigations/:id` | `InvestigationDetailPage` | Lazy |
| R09 | `/evidence` | `EvidenceExplorerPage` | Eager |
| R10 | `/alerts` | `AlertsPage` | Eager |
| R11 | `/sandbox` | `SandboxDashboardPage` | Lazy |
| R12 | `/ai-analysis` | `AIAnalysisPage` | Lazy |
| R13 | `/telemetry` | `LiveTelemetryPage` | Eager |
| R14 | `/reports` | `ReportsPage` | Lazy |
| R15 | `/settings` | `SettingsPage` | Eager |
| R16 | `/audit` | `LogsPage` | Lazy |
| R17 | `/evidence-artifacts` | `EvidenceArtifactsPage` | Lazy |

### 1C — Role-Restricted Routes (`RoleRoute` wrapper)

| # | Path | Component | Load | Allowed Roles |
|---|------|-----------|------|---------------|
| R18 | `/health` | `SystemHealthPage` | Lazy | `admin`, `super_admin` |
| R19 | `/blockchain-operations` | `BlockchainOperationsPage` | Eager | `admin`, `super_admin`, `forensic_analyst` |
| R20 | `/chain-of-custody` | `ChainOfCustodyPage` | Eager | `admin`, `super_admin`, `forensic_analyst` |
| R21 | `/threat-intelligence` | `ThreatIntelligencePage` | Eager | `admin`, `super_admin`, `forensic_analyst` |
| R22 | `/forensic-analytics` | `ForensicAnalyticsPage` | Eager | `admin`, `super_admin` |
| R23 | `/users` | `UsersPage` | Eager | `admin`, `super_admin` |

### 1D — Catch-All / Redirect

| # | Path | Behavior |
|---|------|----------|
| R24 | `/` (empty child) | `Navigate` → `/dashboard` |
| R25 | `*` (catch-all) | `Navigate` → `/dashboard` |

### Route Wrappers

| Wrapper | Behavior |
|---------|----------|
| `PublicRoute` | If `isAuthenticated`, redirect to `/dashboard` |
| `ProtectedRoute` | Checks `checkAuth()`, shows `AuthLoadingScreen` while checking, redirects to `/login` if not authenticated |
| `RoleRoute` | Checks auth + `user.role in allowedRoles`, redirects to `/dashboard` if not allowed |

---

## 2. Screen Inventory

### 2A — Public Screens (5)

**SP01 — LoginPage** (`/login`, 155 lines)
- **State:** email, password, showPassword, step (`login`|`success`), initialReverse, reverseActive
- **Store:** `useAuthStore` (login, isLoading, error, clearError)
- **Forms:** Email input, password input with show/hide toggle
- **States:** loading (spinner on button), error (animated banner), success (animation + "Continue to Dashboard")
- **Interactive:** Show/hide password toggle, success animation on login
- **Navigation:** `/forgot-password` link, `/dashboard` on success

**SP02 — RegisterPage** (`/register`, 361 lines)
- **State:** 17 variables — step (`role`|`email`|`otp`|`password`), role, email, firstName, lastName, otp, emailVerificationToken, password, confirmPassword, showPassword, loading, error, success, otpCooldown, registerSuccess, initialReverse, reverseActive
- **Store:** `useAuthStore` (setState)
- **Forms:** Role selector (2 buttons), email input, 6-digit OTP inputs, firstName/lastName/password/confirmPassword form
- **Validation:** `PASSWORD_REGEX`, email regex, password match, name non-empty
- **States:** loading, error, success, cooldown, 4-step animated flow
- **Navigation:** `/login` link, `/dashboard` on success

**SP03 — ForgotPasswordPage** (`/forgot-password`, 386 lines)
- **State:** 11 variables — step (`email`|`otp`|`password`|`success`), email, otp (6-digit), password, confirmPassword, showPassword, isLoading, error, devOtp, passwordResetToken, cooldown
- **API:** `api.forgotPassword()`, `api.verifyResetOtp()`, `api.resetPassword()`
- **Forms:** Email form, 6-digit OTP form with auto-focus, password + confirm form
- **States:** loading, error, dev mode OTP display, cooldown counter, 4-step animated flow
- **Navigation:** `/login` link, navigate to `/login` on success

**SP04 — ManifestoPage** (`/manifesto`, 121 lines)
- **State:** None (fully static)
- **Stores:** None
- **Data:** `team` array (2 members), `ethics` array (7 items), `principles` array (4 items)
- **Components:** `PublicLayout`, `motion`

**SP05 — DiscoverPage** (`/discover`, 163 lines)
- **State:** None (fully static)
- **Stores:** None
- **Data:** `features` array (6 feature cards), `architectureSteps` array (5 layers)
- **Navigation:** `/login` "Sign In", `/register` "Create Account"
- **Components:** `PublicLayout`, `Link`

### 2B — Authenticated Screens (12)

**SA01 — EnhancedDashboardPage** (`/dashboard`, 460 lines)
- **State:** None (all derived from stores)
- **Stores:** `useInvestigationStore`, `useAlertStore`, `useSandboxStore`, `useThreatIntelStore`
- **API calls:** `fetchInvestigations({ page: 1, limit: 5 })`, `fetchAlerts({ page: 1, limit: 5 })`, `fetchSessions({ page: 1, limit: 20 })`, `fetchStats()`, `loadThreatHistory()`
- **Inline components:** `KPITile` (memo), `Section` (memo), `SeverityBadge`
- **KPI tiles:** Investigations, Alerts, Evidence, Sandbox, Threat Intel (each clickable → page)
- **Navigation:** KPI tiles, "Reports" → `/reports`, "New Investigation" → `/investigations`, "View All" → `/investigations`, investigation items → `/investigations/${id}`
- **Empty states:** investigations (0), alerts (0)
- **Icons:** 8 lucide-react icons

**SA02 — InvestigationsPage** (`/investigations`, 322 lines)
- **State:** 10 variables — searchTerm, statusFilter, priorityFilter, page, showCreateModal, newTitle, newDescription, newPriority, createLoading, menuOpen
- **Store:** `useInvestigationStore` (investigations, isLoading, error, pagination, fetchInvestigations, createInvestigation, deleteInvestigation)
- **Forms:** Create investigation modal (title, description, priority), search input, status filter (5 options), priority filter (5 options)
- **States:** loading (spinner), error (banner), empty (with "New Investigation" button), pagination (>1 page), context menu (View Details, Delete)
- **Data display:** Grid of investigation cards (3 cols) — caseNumber, title, description (2-line clamp), status badge, priority badge, evidenceCount, alertCount, updatedAt
- **Navigation:** Card click → `/investigations/${id}`
- **Pagination:** Previous/Next with page display

**SA03 — InvestigationDetailPage** (`/investigations/:id`, 488 lines, lazy)
- **State:** 5 variables — activeTab (`overview`|`evidence`|`timeline`|`analysis`|`notes`), showNoteModal, noteContent, noteType, noteLoading
- **Stores:** `useInvestigationStore`, `useTimelineStore`, `useAuthStore`
- **API:** `fetchInvestigation(id)`, `updateInvestigation(id, { priority: 'critical' })`, `addNote({...})`
- **Forms:** Add note modal — note type select (observation/finding/conclusion/remediation/escalation), textarea
- **States:** loading (spinner), not found (with back button), error (dismissible banner), empty timeline, empty notes
- **Tabs:** Overview, Evidence, Timeline, AI Analysis, Notes
- **Workflow:** "Escalate" button (updates to critical), "Add Evidence" (placeholder), "Add Note" (opens modal)
- **Navigation:** Back arrow → `/investigations`

**SA04 — EvidenceExplorerPage** (`/evidence`, 361 lines)
- **State:** 4 variables — searchTerm, typeFilter, statusFilter, selectedId
- **Store:** `useEvidenceStore` (evidence, isLoading, error, pagination, fetchEvidence, deleteEvidence, verifyEvidence)
- **Forms:** Search input, type filter (8 types), status filter (3 statuses)
- **States:** loading (spinner), error (dismissible banner), empty, highlight selected, detail panel vs prompt, tags list, verify button conditional
- **Stats:** Total size, verified count, analyzing count
- **Data display:** List of evidence items with right detail panel
- **Workflow:** Verify (triggers local + blockchain verify), Delete (with confirm), View (placeholder), Download (placeholder)

**SA05 — AlertsPage** (`/alerts`, 305 lines)
- **State:** 5 variables — searchTerm, severityFilter, statusFilter, menuOpen, selectedAlert
- **Store:** `useAlertStore` (alerts, isLoading, error, pagination, fetchAlerts, acknowledgeAlert, resolveAlert)
- **Forms:** Search input, severity filter (5 options), status filter (5 options)
- **States:** error (banner), loading (spinner), empty ("All clear"), context menu per alert, modal with alert details, MITRE techniques in modal
- **Data display:** Filtered list of alert cards — severity icon, title, alertId, description, relative time, source, SeverityBadge, StatusBadge
- **Workflow:** "View Details" (opens modal), "Acknowledge", "Resolve" (with summary/actionTaken), context menu (MoreVertical)

**SA06 — LiveTelemetryPage** (`/telemetry`, 258 lines)
- **State:** 2 variables — typeFilter, sourceFilter
- **Store:** `useTelemetryStore` (whole store via const)
- **API:** `telemetry.connect()`, `telemetry.disconnect()`
- **Forms:** Type filter (6 categories), source filter (5 sources)
- **States:** empty ("No telemetry events"), latest (pulsing dot + "Latest" badge), JSON preview for events with data
- **Realtime:** WebSocket-based, connect on mount, disconnect on unmount
- **Workflow:** Pause/Resume stream, Auto-scroll toggle, Clear button
- **Refs:** `streamEndRef`, `streamContainerRef` for auto-scroll

**SA07 — SandboxDashboardPage** (`/sandbox`, 1274 lines, lazy)
- **State:** 8 variables — statusFilter, simulatorFilter, selectedSession, selectedSimulator, activeTab (`sessions`|`monitoring`|`timeline`|`telemetry`|`logs`), sessionStartTime, tick, persistedMonitoring
- **Stores:** `useSandboxStore`, `useTelemetryStore`, `useLogsStore`, `useRealtimeStore`, `useStatusStore`
- **API:** `api.getSessionMonitoring()`, `api.clearSandboxSession()`, Socket.IO listener
- **Forms:** Simulator selector, status filter, simulator filter, log search + level filter, auto-refresh interval selector
- **States:** runtime offline/online, session running (animated banner with elapsed time + Stop), session completed/timed out/failed, loading, empty (sessions/monitoring/telemetry/logs), error, connection dots (green/red)
- **Tabs:** Sessions, Monitoring, Timeline, Telemetry, Logs
- **Workflow:** Start Runtime, New Session, Stop Session, Reset VM, Clear Sessions, Pause/Resume telemetry, Auto-scroll toggle, Export Logs, Copy Logs, Refresh
- **Refs:** 6 refs (prevSessionId, logsEnd, telemetryEnd, logsContainer, telemetryContainer)
- **Effects:** 9 useEffect hooks

**SA08 — AIAnalysisPage** (`/ai-analysis`, 1513 lines, lazy)
- **State:** 8 variables — activeTab (7 types), selectedSessionForAnalysis, expandedTechnique, showCompareModal, analysisMode (4 modes), selectedComparisonSessions, storedAIAnalysis, isLoadingStoredAnalysis
- **Stores:** `useAnalysisStore`, `useSandboxStore`, `useTelemetryStore`, `useReportsStore`, `useThreatIntelStore`
- **API:** `api.getSessionAIAnalysis()`
- **States:** live analyzing badge, active session terminate button, loading stored analysis, re-analyze, live analysis gradient banner, report error toast, data/empty per tab, tab-based render, mode-based render
- **Tabs:** Overview, Threat Classification, MITRE ATT&CK, Attack Chain, Heuristics, Anomalies, Comparison
- **Modes:** Sandbox, Document, URL Intel, Workspace
- **Workflow:** Analyze Session, Compare Sessions, Terminate, Stop, Re-analyze, Refresh, Mode toggles, Technique expand/collapse
- **Visualizations:** AttackChain, EvidenceGraph, MITREHeatmap, RiskScoreGauge
- **Effects:** 5 useEffect hooks
- **Refs:** refreshIntervalRef, eventsRef

**SA09 — ReportsPage** (`/reports`, 414 lines, lazy)
- **State:** 3 variables — search, detailTab (4 types), showDetail
- **Store:** `useReportsStore` (reports, currentReport, isLoading, isDetailLoading, error, pagination, filters, fetchReports, fetchReportById, exportReport, setFilters, clearCurrentReport)
- **Forms:** Search input (debounced), simulator filter (6 options), severity filter (5 options)
- **States:** loading (spinner), error (with retry), empty, pagination (>1 page), detail modal loading, report detail (with 4 tabs), no suspicious activities, hash/integrity display
- **Detail tabs:** Timeline, Events, Suspicious, Summary
- **Workflow:** Report click (opens detail modal), PDF/JSON/TXT export buttons in detail modal, Retry on error
- **Events in detail:** Process, file, registry, network, behavior, system categories

**SA10 — LogsPage** (`/audit`, 630 lines, lazy)
- **State:** 11 variables — search, expandedLog, autoRefreshInterval (default 5), view (`system`|`audit`), auditEntries, auditLoading, auditError, auditStats, auditActionFilter, auditStatusFilter, auditSearch
- **Store:** `useLogsStore` (logs, isLoading, error, filters, autoRefresh, stats, fetchLogs, fetchStats, setFilters, toggleAutoRefresh, clearLogs, downloadLogs)
- **API:** `api.getAuditLogs()`, `api.getAuditStats()`
- **Forms:** Search input (debounced) for both views, action filter (10 types), status filter (3 options), level filter (5 options), category filter (8 options)
- **States:** audit view (4 stat cards + filters), system view (4 stat cards + filters), loading, error (with retry), empty, expanded log details, auto-refresh (pulsing dot + interval selector)
- **Workflow:** View toggle (Audit/System), Refresh, Export (download logs), Auto-refresh toggle + interval, Clear, Filter clicks, Log expand
- **Refs:** bottomRef for auto-scroll

**SA11 — EvidenceArtifactsPage** (`/evidence-artifacts`, 417 lines, lazy)
- **State:** 11 variables — artifacts, selectedArtifact, detail, isLoading, isDetailLoading, error, search, categoryFilter (10 categories), sourceFilter (4 sources), viewMode (`detail`|`json`), pagination
- **API:** `api.getEvidenceArtifacts()`, `api.getEvidenceArtifact()`
- **Forms:** Search input (debounced 300ms), category filter (10 options), source filter (4 options)
- **States:** loading (spinner), error (with Retry), empty (guidance on population), highlight selected, detail panel vs select prompt, relationships section, timeline events, detail/json toggle, blockchain verified checkmark + green dot
- **Workflow:** Artifact selection → detail loading, Copy (clipboard), Download (JSON file), Detail/JSON toggle
- **Pagination:** page/limit/total

**SA12 — SettingsPage** (`/settings`, 426 lines)
- **State:** 3 variables — activeTab (5 types), localSettings, hasChanges
- **Store:** `useSettingsStore` (settings, isLoading, isSaving, error, success, validationErrors, fetchSettings, updateSettings, resetSettings, clearMessages)
- **API:** `fetchSettings()`, `updateSettings(localSettings)`, `resetSettings()`
- **Forms (5 tab sections):**
  - VM: VM Name, Snapshot Name, Startup Timeout (number), Shutdown Timeout (number), Headless Mode (checkbox)
  - Monitoring: Enable Monitoring (checkbox), Polling Interval (number), Log Retention Days (number), 5 target checkboxes (process, file, registry, network, behavior)
  - Execution: Timeout (number), Max Concurrent Sessions (number), Telemetry Limit (number), Auto Rollback (checkbox)
  - Logging: Log Level (Select: 5), Max File Size (Select), Max Files (number)
  - Notifications: Enable Alerts (checkbox), Alert on Completion (checkbox), Alert on Error (checkbox), Webhook URL (url)
- **States:** loading (spinner), error/success (message card), validation errors list
- **Workflow:** "Save Changes" (disabled if no changes), "Reset to Defaults"

### 2C — Role-Restricted Screens (6)

**SR01 — SystemHealthPage** (`/health`, 443 lines, lazy)
- **State:** 4 variables — services, isLoading, lastRefresh, systemMetrics (uptime, cpu, memory, storage, activeConnections)
- **Store:** `useSandboxStore` (health, monitoringStatus, executionStatus, fetchHealth, fetchMonitoringStatus, fetchExecutionStatus)
- **API:** `api.getSandboxHealth()`, `api.get('/operations/health')`, `api.get('/ai/health')`, `api.getSandboxSimulators()`
- **States:** loading (spinner), service list (green/amber/red dots), response time display
- **Service checks:** Sandbox Runtime, Backend API, MongoDB, Blockchain, AI Analysis Engine, Simulator Catalog
- **Workflow:** "Refresh" triggers full health check
- **Visualizations:** Inline SVG CPU/Memory/Storage ring gauges
- **Access:** `admin`, `super_admin`

**SR02 — BlockchainOperationsPage** (`/blockchain-operations`, 67 lines)
- **State:** None (delegated to child components)
- **Stores:** `useAuthStore` (user), `useBlockchainStore` (status, fetchStatus)
- **States:** Offline mode banner, admin-only ReconciliationPanel
- **Components:** `BlockchainOperationsPanel`, `ReconciliationPanel`
- **Access:** `admin`, `super_admin`, `forensic_analyst`

**SR03 — ChainOfCustodyPage** (`/chain-of-custody`, 241 lines)
- **State:** 7 variables — stats, alerts, custodyChain, evidenceIdInput, loading, error, hoveredEvent
- **API:** `api.get('/custody/integrity-stats')`, `api.getTamperAlerts()`, `api.get('/custody/chain/...')`
- **Forms:** Evidence ID lookup input with "Trace" button, Enter key support
- **States:** 5 stat cards, error below input, custody timeline, hover tooltip with tx details, VERIFIED badge, tamper alert list/empty
- **Navigation:** "View on Explorer" → blockchain explorer URL (configurable) in new tab
- **Access:** `admin`, `super_admin`, `forensic_analyst`

**SR04 — ThreatIntelligencePage** (`/threat-intelligence`, 321 lines)
- **State:** 4 variables — iocs, graphNodes, graphEdges, loading
- **API:** `api.get('/threat/iocs?limit=50')`
- **States:** loading (full-page spinner), graph/empty, IOC table/empty
- **Interactive:** Force-directed graph (canvas with physics simulation), node pulsing animation, color-coded by severity
- **Data tables:** IOC table (Indicator, Type, Severity badge, Score bar)
- **Sub-components:** `ThreatMapCanvas` (canvas rendering, physics, repulsion/attraction/gravity/bounds)
- **Refs:** canvasRef, animRef, nodesRef
- **Access:** `admin`, `super_admin`, `forensic_analyst`

**SR05 — ForensicAnalyticsPage** (`/forensic-analytics`, 227 lines)
- **State:** 4 variables — detectedTechniques, expandedTechnique, dashboardData, loading
- **API:** `api.get('/analytics/dashboard')`
- **States:** loading (full-page spinner), 4 stat cards, correlation insights, technique detail panel (AnimatePresence)
- **Interactive:** Clickable MITRE ATT&CK matrix grid cells with glow effects, technique expand/collapse
- **Static data:** `MITRE_TACTICS` (11), `MITRE_TECHNIQUES` (28 across 11 tactics)
- **Access:** `admin`, `super_admin`

**SR06 — UsersPage** (`/users`, 422 lines)
- **State:** 13 variables — users, loading, searchQuery, debouncedSearch, currentPage, totalPages, totalUsers, showCreateModal, showEditModal, showDeleteModal, selectedUser, error, formData
- **Store:** `useAuthStore` (current user)
- **API:** `api.getUsers()`, `api.createUser()`, `api.updateUser()`, `api.deleteUser()`
- **Forms:** Create user modal (Name, Email, Password, Role select, Department), Edit user modal (Name, Email, Password optional, Role, Department), Delete confirmation modal
- **States:** error (banner), loading, empty ("No users found"), hide delete for self, pagination (>1 page)
- **Data table:** Users Table (User name+email, Role badge with Shield, Department, Created date, Actions Edit+Delete)
- **Search:** Debounced at 300ms
- **Pagination:** Math.ceil(total / 10)
- **Hook:** `useDebounce`
- **Access:** `admin`, `super_admin`

### 2D — Layouts & Providers (3)

**LP01 — MainLayout** (`layouts/MainLayout.tsx`, 149 lines)
- **Structure:** Sidebar (collapsible 260px/72px) + Header (sticky, breadcrumbs) + StatusBanner (global) + `<Outlet />` (animated)
- **State:** `sidebarCollapsed` (useState)
- **Store:** `useStatusStore` (status, dismiss) for global StatusBanner
- **Breadcrumbs:** Route-based mapping (15 routes), Home prefix
- **Page names:** 15 route → human-readable mapping
- **Animation:** AnimatePresence mode="wait" with 250ms fade + 8px y-shift
- **Suspense:** Lazy pages show Loader2 spinner

**LP02 — PageContainer / Page Components** (`layouts/PageContainer.tsx`, 184 lines)
- Exports: `PageHeader` (title, subtitle, actions, badge), `PageSection` (title, description, noPadding), `PageGrid` (columns 1-4), `PageContainer` (maxWidth full/5xl/4xl/3xl/2xl), `EmptyState` (icon, title, description, action), `LoadingSkeleton` (rows)
- Used by: 8+ pages

**LP03 — ThemeProvider** (`providers/ThemeProvider.tsx`)
- Force-dark mode: applies `dark` class to `<html>`, sets CSS custom properties
- Uses `themeStore` (light/dark) but it's dead code — always dark

---

## 3. Component Inventory

### 3A — UI Primitives (7 files)

**C01 — Button** (`components/ui/Button.tsx`, 153 lines)
- `Button`: variant (`primary`|`secondary`|`solid`|`outline`|`ghost`|`danger`|`success`), size (`xs`|`sm`|`md`|`lg`), loading (spinner), leftIcon, rightIcon, fullWidth, disabled
- `IconButton`: variant, size, icon, label (aria), loading
- Animations: `active:scale-95`, transition-all duration-150
- 7 variant classes using Tailwind

**C02 — Card** (`components/ui/Card.tsx`, 115 lines)
- `Card`: variant (`default`|`elevated`|`bordered`|`ghost`|`accent`), padding (`none`|`sm`|`md`|`lg`), hover (y-shift on hover)
- `Card.Header`: title, description, action, children mode
- `Card.Content`: children
- `Card.Footer`: children
- Static sub-components via `Card.Header = CardHeader`, etc.

**C03 — Badge** (`components/ui/Badge.tsx`, 120 lines)
- `StatusBadge`: status (12 values mapped to colors), size (`sm`|`md`|`lg`), showDot, pulse (auto for active statuses)
- `SeverityBadge`: severity (`critical`|`high`|`medium`|`low`|`info`), size, showIcon
- `CountBadge`: count, max (default 99), variant (`default`|`primary`|`danger`)
- Animations: fadeIn + scaleIn

**C04 — Input** (`components/ui/Input.tsx`, 105 lines)
- `Input`: label, error, helperText, leftIcon, rightIcon, fullWidth, forwardRef + useId
- `Textarea`: label, error, helperText, fullWidth, resize-y min-h-[80px]
- Error state: red border + AlertCircle icon + red helper text

**C05 — Select** (`components/ui/Select.tsx`, 74 lines)
- `Select`: label, error, helperText, options array ({value, label, disabled}), placeholder, fullWidth, onChange(value), forwardRef + useId
- Custom: appearance-none, ChevronDown icon, auto-insert placeholder option

**C06 — Modal** (`components/ui/Modal.tsx`, 63 lines)
- `Modal`: isOpen, onClose, title, size (`sm`|`md`|`lg`|`xl`), children
- Backdrop: bg-slate-900/50 backdrop-blur-sm, click-to-close
- Animation: fadeIn backdrop + scaleIn+slideUp content
- Close button: X icon with hover state

**C07 — StatusBanner** (`components/ui/StatusBanner.tsx`, 97 lines)
- `StatusBanner`: status (type `StatusMessage`: id, type (`info`|`success`|`warning`|`error`|`loading`), message, detail), onDismiss
- 5 type configs with icons (CheckCircle, AlertCircle, Loader2, Info, X)
- Animations: AnimatePresence slideDown
- `StatusProvider`: placeholder (returns null)

### 3B — Layout Components (4 files)

**C08 — Sidebar** (`components/layout/Sidebar.tsx`)
- Props: collapsed (boolean), onToggle (setter)
- Contains: app logo, 19 navigation items with icons, collapse toggle
- Nav items: Dashboard, Investigations, Evidence, Alerts, Sandbox, AI Analysis, Telemetry, Reports, Settings, Audit Log, Evidence Artifacts, System Health, Blockchain Operations, Chain of Custody, Threat Intel, Forensic Analytics, User Management

**C09 — Header** (`components/layout/Header.tsx`)
- Props: breadcrumbs (array), currentPage (string)
- Contains: breadcrumb trail, current page label

**C10 — ConnectionStatus** (`components/layout/ConnectionStatus.tsx`)
- Displays: WebSocket connection status indicator

**C11 — PublicLayout** (`components/PublicLayout.tsx`)
- Layout for login/register/forgot-password/manifesto/discover pages

### 3C — Enterprise Components (1 file, 6 components)

**C12 — DashboardGrid** (`components/enterprise/DashboardGrid.tsx`, 248 lines)
- `DashboardGrid`: children, className (CSS grid container)
- `DashboardCard`: children, span, rowSpan, header, footer, hover, onClick, animation fadeIn + y-shift
- `DashboardHeader`: title, subtitle, action
- `DashboardStat`: label, value, change (value+type increase/decrease/neutral), icon, delta, trend indicators
- `DashboardList`: items array, onItemClick, renderItem, status classes (active/warning/error)
- `DashboardChart`: children, height (default 200px)

### 3D — Blockchain Components (2 files)

**C13 — BlockchainOperationsPanel** (`components/blockchain/BlockchainOperationsPanel.tsx`, 421 lines)
- State: activeTab (`sync`|`worker`|`health`)
- Store: `useBlockchainStore` (syncState, syncQueueStatus, workerStats, healthMetrics, fetchSyncStatus, fetchWorkerStatus, fetchHealthMetrics, processSyncQueue, retryFailedSync, runReconciliation, isLoading)
- Sync tab: health badge (healthy/degraded/unhealthy), 4 stat cards (Pending, Failed, Total Synced, On Chain), queue status (5 metrics), timestamps, 3 action buttons (Process Queue, Retry Failed, Run Reconciliation)
- Worker tab: 5 stat cards (Total Jobs, Queued, Processing, Completed, Failed), priority distribution, empty state
- Health tab: score out of 100, status badge, 4 metric cards (Blockchain Connection, Verification Success %, Sync Queue Health, Data Integrity), issues list / no issues
- Auto-refresh: 30s interval

**C14 — ReconciliationPanel** (`components/blockchain/ReconciliationPanel.tsx`, 255 lines)
- State: selectedSeverity, showResolved, resolveModal, resolutionText
- Store: `useBlockchainStore` (reconciliationIssues, reconciliationStats, fetchReconciliationIssues, fetchReconciliationStats, resolveReconciliationIssue, runReconciliation, isLoading)
- Stats bar: 5 metrics (Total, Critical, High, Resolved Today, Auto-Resolved)
- Filters: severity select, show resolved checkbox
- List: severity-colored cards (critical=red, high=orange, medium=yellow, low=default), type labels, description, evidenceId, timestamp, resolved badge, Resolve button
- Resolve modal: textarea + Cancel/Resolve buttons (disabled until text entered)

### 3E — Threat Intelligence Components (5 files)

**C15 — AnalysisResultCard** (`components/threat-intelligence/AnalysisResultCard.tsx`)
- Display: Threat analysis summary with score, findings, IOCs

**C16 — DocumentAnalysisView** (`components/threat-intelligence/DocumentAnalysisView.tsx`)
- Display: Document analysis results, sections, suspicious indicators

**C17 — UrlAnalysisView** (`components/threat-intelligence/UrlAnalysisView.tsx`)
- Display: URL reputation, categories, redirect chain, technologies

**C18 — ThreatSummaryBar** (`components/threat-intelligence/ThreatSummaryBar.tsx`)
- Display: Summary bar with key metrics

**C19 — IocPanel** (`components/threat-intelligence/IocPanel.tsx`)
- Display: IOC table/list with types, values, severity

### 3F — Visualization Components (5 files)

**C20 — AttackChain** (`components/visualizations/AttackChain.tsx`)
- Visual: Attack chain stages as connected nodes

**C21 — EvidenceGraph** (`components/visualizations/EvidenceGraph.tsx`)
- Visual: Evidence relationship network graph

**C22 — MITREHeatmap** (`components/visualizations/MITREHeatmap.tsx`)
- Visual: MITRE ATT&CK matrix heatmap

**C23 — RiskScoreGauge** (`components/visualizations/RiskScoreGauge.tsx`)
- Visual: Risk score gauge/meter

**C24 — Visualization Index** (`components/visualizations/index.ts`)
- Re-exports all 4 visualization components

### 3G — Infrastructure Components (3 files)

**C25 — ErrorBoundary** (`components/ErrorBoundary.tsx`)
- Error boundary with fallback UI

**C26 — AuthLoadingScreen** (inline in `AppRoutes.tsx`)
- Full-screen loading: NyxTrace logo, spinning border, "Loading platform..." text, inline spin keyframe

**C27 — ThreatMapCanvas** (inline in `ThreatIntelligencePage.tsx`)
- Custom canvas force-directed graph: physics simulation (repulsion, attraction, center gravity, bounds), node pulsing, color-coded by severity (red≥70, amber≥40, cyan<40), glow effects

### 3H — Page-Specific Inline Components

| Component | Defined In | Description |
|-----------|-----------|-------------|
| `KPITile` | `EnhancedDashboardPage` | Dashboard KPI tile (label, value, icon, trend, accent, onClick) |
| `Section` | `EnhancedDashboardPage` | Dashboard section wrapper (title, meta, action, children) |
| `SeverityBadge` | `EnhancedDashboardPage` | Inline severity badge (independent from ui/Badge) |

---

## 4. Form Inventory

| # | Page | Form Name | Fields | Validation | Submission |
|---|------|-----------|--------|------------|------------|
| F01 | LoginPage | Login Form | email (text), password (password + show/hide) | N/A | `handleSubmit` → `login({email, password})` |
| F02 | RegisterPage | Role Selection | 2 buttons: Analyst, Administrator | Must select one | → step="email" |
| F03 | RegisterPage | Email Entry | email (text) | `/\S+@\S+\.\S+/` | `api.post('/auth/send-otp', ...)` |
| F04 | RegisterPage | OTP Verification | 6 individual digit inputs (auto-focus) | 6 digits | `api.post('/auth/verify-otp', ...)` |
| F05 | RegisterPage | Password Setup | firstName, lastName, password, confirmPassword | `PASSWORD_REGEX`, match, non-empty | `api.post('/auth/register', ...)` |
| F06 | ForgotPasswordPage | Email Entry | email (text) | N/A | `api.forgotPassword(email)` |
| F07 | ForgotPasswordPage | OTP Entry | 6 individual digit inputs (auto-focus) | 6 digits | `api.verifyResetOtp(email, otp)` |
| F08 | ForgotPasswordPage | Password Reset | password, confirmPassword | match | `api.resetPassword(...)` |
| F09 | InvestigationsPage | Create Investigation | title (text), description (textarea), priority (Select: low/medium/high/critical) | Non-empty title | `createInvestigation({...})` |
| F10 | InvestigationDetailPage | Add Note | type (Select: observation/finding/conclusion/remediation/escalation), content (textarea) | Non-empty | `addNote({...})` |
| F11 | SettingsPage | VM Configuration | VM Name (text), Snapshot Name (text), Startup Timeout (number), Shutdown Timeout (number), Headless Mode (checkbox) | N/A | Part of `updateSettings(localSettings)` |
| F12 | SettingsPage | Monitoring | Enable Monitoring (checkbox), Polling Interval (number), Log Retention Days (number), 5 target checkboxes | N/A | Part of `updateSettings(localSettings)` |
| F13 | SettingsPage | Execution | Timeout (number), Max Concurrent Sessions (number), Telemetry Limit (number), Auto Rollback (checkbox) | N/A | Part of `updateSettings(localSettings)` |
| F14 | SettingsPage | Logging | Log Level (Select: 5), Max File Size (Select), Max Files (number) | N/A | Part of `updateSettings(localSettings)` |
| F15 | SettingsPage | Notifications | Enable Alerts (checkbox), Alert on Completion (checkbox), Alert on Error (checkbox), Webhook URL (url) | URL format | Part of `updateSettings(localSettings)` |
| F16 | ChainOfCustodyPage | Evidence Lookup | evidenceIdInput (text + Enter key) | N/A | `api.get('/custody/chain/...')` |
| F17 | UsersPage | Create User | Name (text), Email (text), Password (text), Role (Select: 4), Department (text) | Non-empty required | `api.createUser(formData)` |
| F18 | UsersPage | Edit User | Name (text), Email (text), Password optional, Role (Select), Department (text) | Partial required | `api.updateUser(id, formData)` |
| F19 | UsersPage | Delete Confirm | Confirmation text | Text match | `api.deleteUser(id)` |

### Filter Forms (14 filter bars across pages)

| # | Page | Filters |
|---|------|---------|
| F20 | InvestigationsPage | search (text), status (Select: 5), priority (Select: 5) |
| F21 | AlertsPage | search (text), severity (Select: 5), status (Select: 5) |
| F22 | EvidenceExplorerPage | search (text), type (Select: 8), status (Select: 3) |
| F23 | EvidenceArtifactsPage | search (debounced), category (Select: 10), source (Select: 4) |
| F24 | LiveTelemetryPage | type (Select: 6), source (Select: 5) |
| F25 | ReportsPage | search (debounced), simulator (Select: 6), severity (Select: 5) |
| F26 | SandboxDashboardPage | status (Select: 5), simulator (Select: dynamic) |
| F27 | LogsPage (audit) | search (debounced), action (Select: 10), status (Select: 3) |
| F28 | LogsPage (system) | search (debounced), level (Select: 5), category (Select: 8) |
| F29 | ReconciliationPanel | severity (Select: 4), show resolved (checkbox) |

---

## 5. State Inventory

### 5A — Zustand Stores (16)

**S01 — `useAuthStore`** (`stores/authStore.ts`, 167 lines)
- **State:** user, token, isAuthenticated, isLoading, error, permissions
- **Persistence:** localStorage ("auth-storage") via zustand persist middleware — partializes token, user, permissions
- **Actions:** login (→ `api.login`), logout (→ `api.logout`), checkAuth (→ `api.getCurrentUser`), clearError, hasPermission, hasRole, isAdmin
- **Token management:** localStorage accessToken + refreshToken, auto-refresh interceptor in api.ts

**S02 — `useAlertStore`** (`stores/alertStore.ts`, 130 lines)
- **State:** alerts[], currentAlert, isLoading, error, pagination
- **Actions:** fetchAlerts (→ `api.getAlerts`), fetchAlert (→ `api.getAlert`), acknowledgeAlert (→ `api.acknowledgeAlert`), resolveAlert (→ `api.resolveAlert`), clearCurrentAlert
- **Optimistic:** Updates local state on acknowledge/resolve

**S03 — `useEvidenceStore`** (`stores/evidenceStore.ts`, 143 lines)
- **State:** evidence[], currentEvidence, isLoading, error, pagination
- **Actions:** fetchEvidence, fetchEvidenceByInvestigation, fetchEvidenceById, uploadEvidence (→ `api.uploadEvidence`), verifyEvidence (→ `api.verifyEvidence` + triggers blockchainStore.verifyEvidence), deleteEvidence (→ `api.deleteEvidence`), clearCurrentEvidence
- **Cross-store:** verifyEvidence triggers `useBlockchainStore.getState().verifyEvidence()`

**S04 — `useInvestigationStore`** (`stores/investigationStore.ts`)
- **State:** investigations[], currentInvestigation, isLoading, error, pagination
- **Actions:** fetchInvestigations, fetchInvestigation, createInvestigation, updateInvestigation, deleteInvestigation

**S05 — `useBlockchainStore`** (`stores/blockchainStore.ts`, 918 lines — largest store)
- **State:** status, stats, verificationHistory (Map), tamperAlerts, integrityRecords, auditLog, transactions, transactionStats, contractEvidence (Map), syncState, syncQueueStatus, workerStats, verificationJobs (Map), reconciliationIssues, reconciliationStats, healthMetrics, isLoading, error
- **Actions (40+):** fetchStatus, fetchStats, verifyEvidence, batchVerify, createPackage, verifyPackage, registerEvidence, fetchAuditLog, fetchIntegrityRecords, fetchTamperAlerts, acknowledgeAlert, getVerificationHistory, generateHash, verifyHash, registerOnContract, verifyOnContract, getContractEvidence, checkContractEvidence, fetchTransactions, fetchTransactionStats, retryTransaction, recordAuditEntry, fetchEvidenceAuditFromChain, recordTamperDetection, getExplorerUrl, fetchSyncStatus, queueForSync, processSyncQueue, retryFailedSync, checkConsistency, fetchWorkerStatus, createVerificationJob, getJobStatus, cancelJob, runReconciliation, fetchReconciliationIssues, resolveReconciliationIssue, fetchReconciliationStats, fetchBlockchainState, fetchHealthMetrics
- **API base path:** All under `/blockchain/...`

**S06 — `useAnalysisStore`** (`stores/analysisStore.ts`, 246 lines)
- **State:** dashboardData, isLoadingDashboard, dashboardError, currentReport, currentSessionAnalysis, isLoadingReport, reportError, comparisonResult, selectedSessions, isComparing, liveSessionId, liveEvents, isLiveAnalyzing, patterns, isLoadingPatterns, anomalies, isLoadingAnomalies, insights, clusters, isLoadingInsights, error
- **Actions:** loadDashboard, loadAnalysis, analyzeSession, compareSessions, selectSessionForComparison, clearComparison, startLiveAnalysis, updateLiveEvents, stopLiveAnalysis, loadPatterns, loadAnomalies, loadInsights, clearReport

**S07 — `useSandboxStore`** (`stores/sandboxStore.ts`)
- **State:** sessions, stats, health, monitoringStatus, executionStatus, simulators, activeSession, isLoading, isExecuting
- **Actions:** fetchSessions, fetchStats, fetchSimulators, fetchHealth, fetchMonitoringStatus, fetchExecutionStatus, startSession, stopSession, resetVm, startRuntime

**S08 — `useTelemetryStore`** (`stores/telemetryStore.ts`)
- **State:** events, isConnected, autoScroll, isPaused
- **Actions:** connect, disconnect, togglePause, toggleAutoScroll, clear

**S09 — `useLogsStore`** (`stores/logsStore.ts`)
- **State:** logs, isLoading, error, filters, autoRefresh, stats
- **Actions:** fetchLogs, fetchStats, setFilters, toggleAutoRefresh, clearLogs, downloadLogs

**S10 — `useReportsStore`** (`stores/reportsStore.ts`)
- **State:** reports, currentReport, isLoading, isDetailLoading, error, pagination, filters
- **Actions:** fetchReports, fetchReportById, exportReport, setFilters, clearCurrentReport

**S11 — `useSettingsStore`** (`stores/settingsStore.ts`)
- **State:** settings, isLoading, isSaving, error, success, validationErrors
- **Actions:** fetchSettings (→ `api.getSettings`), updateSettings (→ `api.updateSettings`), resetSettings (→ `api.resetSettings`), clearMessages

**S12 — `useThreatIntelStore`** (`stores/threatIntelStore.ts`)
- **State:** analysisHistory, summary, isLoading
- **Actions:** loadHistory, loadAnalysis

**S13 — `useTimelineStore`** (`stores/timelineStore.ts`)
- **State:** events, notes
- **Actions:** setEvents, addNote

**S14 — `useRealtimeStore`** (`stores/realtimeStore.ts`)
- **State:** isConnected (Socket.IO connection)
- **Actions:** / (read-only via Socket.IO)

**S15 — `useStatusStore`** (`stores/statusStore.ts`)
- **State:** status (StatusMessage | null)
- **Actions:** set, dismiss

**S16 — `useThemeStore`** (`stores/themeStore.ts`)
- **State:** theme (light/dark)
- **Actions:** toggleTheme, setTheme
- **Note:** Dead code — ThemeProvider force-dark overrides this

### 5B — Services (2)

**SVC01 — api.ts** (`services/api.ts`, ~893 lines)
- **Framework:** axios with interceptors
- **Features:** Token injection (Authorization header), 401-triggered refresh token rotation with request queuing, retry logic (2 retries on network/5xx), request dedup (1s TTL), correlation IDs, backend health detection (CustomEvent dispatch), `_id`→`id` normalization
- **Methods (40+):** login, logout, getCurrentUser, refreshToken, getAlerts, getAlert, acknowledgeAlert, resolveAlert, getEvidence, getEvidenceById, getEvidenceByInvestigation, uploadEvidence, verifyEvidence, deleteEvidence, getInvestigations, getInvestigation, createInvestigation, updateInvestigation, deleteInvestigation, getDashboardStats, getAnalyticsDashboard, getComprehensiveForensicReport, analyzeSessionForensic, compareSessions, getBehavioralPatterns, detectAnomalies, getCorrelationInsights, getInvestigationClusters, getReports, getReport, exportReport, getSandboxSessions, getSandboxStats, getSandboxSimulators, getSandboxHealth, startSandboxSession, stopSandboxSession, getSessionMonitoring, getEvidenceArtifacts, getEvidenceArtifact, getAuditLogs, getAuditStats, getSettings, updateSettings, resetSettings, forgotPassword, verifyResetOtp, resetPassword, getUsers, createUser, updateUser, deleteUser, get, post

**SVC02 — socket.ts** (`services/socket.ts`)
- **Framework:** Socket.IO client
- **Events:** SANDBOX_SESSION_UPDATE, telemetry events, alert events
- **Connection:** Auto-connect with token, auto-reconnect

### 5C — Types (3 files)

- `types/index.ts` (677 lines): User, Auth, Investigation, Evidence, Alert, SandboxSession, Telemetry, AI Analysis, Dashboard, API Response, Pagination, Permissions, Behavioral, Anomaly, InvestigationCluster, CorrelationInsight, Threat Intel (includes re-export of blockchain)
- `types/blockchain.ts` (185 lines): Enums (VerificationStatus, EvidenceIntegrityState, BlockchainEventType), Interfaces (BlockchainStatus, VerificationStats, VerificationRecord, TamperAlert, BlockchainAuditEntry, EvidencePackageHash, EvidenceIntegrityRecord, BatchVerificationResult, etc.)
- `types/reports.ts` (201 lines): ForensicReportSummary, ForensicReportDetail, ForensicEvent, BehaviorSummary, SuspiciousActivity, ExecutionSummary, CollectionIntegrity, LogEntry, AppSettings (VM, Monitoring, Execution, Logging, Notification), EvidenceArtifact, ForensicEvidenceDetail, EventRelationship

### 5D — Config (`config/index.ts`, 94 lines)

| Key | Default | Description |
|-----|---------|-------------|
| `apiUrl` | `/api/v1` | Backend API base URL |
| `aiServiceUrl` | `http://localhost:8000` | AI microservice URL |
| `blockchainExplorerUrl` | `https://sepolia.etherscan.io` | Block explorer URL |
| `appName` | `NyxTrace` | Application name |
| `appVersion` | `0.0.0` | Application version |
| `polling.connectionHealthMs` | 15,000 | Connection status refresh interval |
| `polling.systemHealthMs` | 15,000 | System health refresh interval |
| `polling.sandboxSessionMs` | 3,000 | Sandbox session poll interval |
| `polling.sandboxSessionMaxAttempts` | 90 | Max session poll attempts |
| `api.requestTimeoutMs` | 10,000 | Default request timeout |
| `api.longRequestTimeoutMs` | 20,000 | Long request timeout |
| `api.maxRetries` | 2 | Max retries on failure |
| `api.dedupTtlMs` | 1,000 | Request dedup cache TTL |
| `realtime.telemetryBufferSize` | 50 | Telemetry event buffer |
| `realtime.liveAlertsBufferSize` | 20 | Live alert buffer |

### 5E — Hooks & Utils

- `hooks/useDebounce.ts`: Debounce hook (used by UsersPage)
- `utils/helpers.ts` (105 lines): `formatDate`, `formatDateTime`, `formatRelativeTime`, `formatFileSize`, `formatDuration`, `truncate`, `getSeverityColor`, `getStatusColor`, `getPriorityIcon`, `generateCaseNumber`

### 5F — Design System (`design-system/index.ts`, 536 lines)

- **Tokens:** spacing (25 values), typography (fontFamily, fontSize 10, fontWeight 5, lineHeight 5, letterSpacing 5), colors (primary/amber, secondary/teal, tertiary/violet, severity 5, status 4, background 5, border 3, text 5), shadows (11), radii (10), transitions (duration 4, easing 5), zIndex (7), animations (11 keyframes)
- **Component variants:** buttonVariants (7), cardVariants (5)
- **Functions:** cn (clsx wrapper), responsive, cssVar, formatDate, getRelativeTime
- **Hook:** useDesignSystem
- **Note:** Duplicated in Tailwind v4 `@theme` block in `src/index.css`

---

## 6. Workflow Inventory

### 6A — Authentication Workflows

**W01 — Login Flow**
1. User enters email + password
2. Click "Login" (or Enter)
3. Loading spinner on button
4. Error? → animated error banner
5. Success? → "Welcome back" animation → 1.5s delay → navigate `/dashboard`
6. Already authenticated? → `PublicRoute` redirects to `/dashboard`

**W02 — Registration Flow**
1. Role selection (Analyst/Administrator) → animated transition
2. Enter email → "Request Access Code"
3. `api.sendOtp` → OTP step
4. 6-digit OTP input with auto-focus between fields (max 1 char each)
5. `api.verifyOtp` → Password setup step
6. Enter name + password + confirm → `api.register`
7. On success → navigate `/dashboard`

**W03 — Password Reset Flow**
1. Enter email → "Send Verification Code"
2. `api.forgotPassword` → OTP sent
3. 6-digit OTP with auto-focus → "Verify Code"
4. `api.verifyResetOtp` → reset token
5. Enter new password + confirm → "Reset Password"
6. `api.resetPassword` → success animation
7. "Back to Login" → navigate `/login`

**W04 — Session Auth Check**
1. App loads → `ProtectedRoute` calls `checkAuth()`
2. Shows `AuthLoadingScreen` (NyxTrace logo + spinner + "Loading platform...")
3. Token in localStorage? → `api.getCurrentUser()` to validate
4. Valid → render layout
5. Invalid → redirect `/login`

**W05 — Token Refresh**
1. API returns 401
2. Interceptor catches → checks refresh token
3. Calls refresh endpoint with stored refresh token
4. Queues all pending requests
5. On success → retries all queued requests with new token
6. On failure → logout → redirect `/login`

### 6B — Investigation Workflows

**W06 — Create Investigation**
1. Click "New Investigation" button
2. Modal opens with title, description, priority
3. Fill form → click Create
4. Loading → API call → modal closes → list refreshes
5. Error → error banner

**W07 — View Investigation Detail**
1. Click investigation card/list item
2. Navigate to `/investigations/:id`
3. Lazy-loaded `InvestigationDetailPage`
4. Loads investigation data via store
5. Tabbed view: Overview, Evidence, Timeline, AI Analysis, Notes
6. Not found? → "Investigation not found" with back button

**W08 — Escalate Investigation**
1. Click "Escalate to Critical" button
2. Calls `updateInvestigation(id, { priority: 'critical' })`
3. Priority badge updates in UI

**W09 — Add Note to Investigation**
1. Click "Add Note" button
2. Modal opens with note type select + textarea
3. Fill → click Add
4. Loading → API call → modal closes → notes list refreshes

### 6C — Evidence Workflows

**W10 — Upload Evidence**
1. Navigate to `/evidence` (or `/investigations/:id`)
2. Click "Upload" button
3. File selector opens (multipart/form-data)
4. Upload progress? → (no progress bar)
5. On completion → evidence list refreshes

**W11 — Verify Evidence**
1. Click "Verify" button on an evidence row
2. `evidenceStore.verifyEvidence(id)` called
3. Local verification: `api.verifyEvidence(id)` → marks as verified
4. Blockchain verification: triggers `blockchainStore.verifyEvidence()` async
5. On blockchain success → shows blockchainVerified checkmark

**W12 — Delete Evidence**
1. Click Delete button
2. Confirm dialog (native confirm)
3. `evidenceStore.deleteEvidence(id)` called
4. Evidence removed from list

### 6D — Blockchain Workflows

**W13 — Blockchain Sync Operations**
1. Navigate to `/blockchain-operations`
2. BlockchainOperationsPanel loads with sync/worker/health tabs
3. Sync status auto-refreshes every 30s
4. Actions: Process Queue, Retry Failed, Run Reconciliation
5. Offline mode detected → amber banner

**W14 — Reconciliation**
1. Admin clicks "Run Full Reconciliation" (in ReconciliationPanel)
2. `runReconciliation()` called via store
3. Issues populate in list
4. Admin can filter by severity, show resolved
5. Admin clicks "Resolve" → textarea → submit resolution
6. Issue marked resolved in list

**W15 — Evidence Chain of Custody Trace**
1. Navigate to `/chain-of-custody`
2. Enter evidence ID → click "Trace" (or Enter)
3. API fetches custody chain
4. Timeline displayed with verified/unverified events
5. Hover over verified event → tooltip with txHash
6. "View on Explorer" → opens block explorer in new tab

### 6E — Sandbox Workflows

**W16 — Start Runtime**
1. If runtime not started → "Start Runtime" button shown
2. Click → `startRuntime()` called
3. When online → health indicators green

**W17 — Sandbox Session Lifecycle**
1. Select simulator from dropdown
2. Click "New Session" → `startSession(simulatorId)`
3. Session starts → animated banner with elapsed time
4. Telemetry streams in real-time
5. Options: Stop, Terminate, Reset VM
6. On completion → session in list with report link
7. "Clear Sessions" → removes all history

### 6F — AI Analysis Workflows

**W18 — Session Forensic Analysis**
1. Navigate to `/ai-analysis`
2. Select sandbox mode
3. Choose session from dropdown
4. Click "Analyze Session"
5. Results populate 7 tabs: Overview, Threat Classification, MITRE ATT&CK, Attack Chain, Heuristics, Anomalies, Comparison

**W19 — Live Analysis**
1. With active sandbox session
2. Click "Start Live Analysis" (or auto-starts)
3. Events stream in 1s polling
4. Live badge with event count
5. Click "Stop" → analysis freezes

**W20 — Session Comparison**
1. Click "Compare Sessions"
2. Modal with session checkboxes (max 2)
3. Select 2 → click Compare
4. Side-by-side comparison with deltas

**W21 — Document/URL Analysis**
1. Switch to Document or URL Intel mode
2. Upload file / enter URL
3. Analysis results with threat score, IOCs, sections

### 6G — Telemetry Workflows

**W22 — Live Telemetry Monitoring**
1. Navigate to `/telemetry`
2. WebSocket connects automatically
3. Events stream in real-time with auto-scroll
4. Filter by type/source
5. Pause/Resume streaming
6. Clear events
7. Auto-scroll toggle

### 6H — Reporting Workflows

**W23 — View & Export Reports**
1. Navigate to `/reports`
2. Filter by simulator/severity/search
3. Click report → detail modal opens
4. 4 detail tabs: Timeline, Events, Suspicious, Summary
5. Click "PDF"/"JSON"/"TXT" → downloads report

### 6I — Settings Workflows

**W24 — Update Settings**
1. Navigate to `/settings`
2. 5 tab sections: VM, Monitoring, Execution, Logging, Notifications
3. Edit fields
4. "Save Changes" → `updateSettings(localSettings)`
5. "Reset to Defaults" → `resetSettings()`
6. Validation errors shown per field
7. Success/error message card

### 6J — User Management Workflows

**W25 — CRUD Users**
1. Navigate to `/users` (admin/super_admin)
2. Search users (debounced 300ms)
3. Pagination (10 per page)
4. "Add User" → create modal (name, email, password, role, department)
5. Edit → edit modal (same fields, password optional)
6. Delete → confirmation → `api.deleteUser(id)`
7. Cannot delete self

### 6K — Admin Workflows

**W26 — System Health Check**
1. Navigate to `/health` (admin/super_admin)
2. 6 service checks: Sandbox Runtime, Backend API, MongoDB, Blockchain, AI Engine, Simulator Catalog
3. Response time per service
4. Inline SVG ring gauges: CPU, Memory, Storage
5. Active connections count
6. "Refresh" button triggers all checks
7. Auto-refresh via config interval

**W27 — Audit Log Review**
1. Navigate to `/audit`
2. Two modes: System logs or Audit trails
3. Filter by level/category/action/status
4. Auto-refresh with interval selector
5. Export logs as download
6. Expand individual log entries for JSON details

---

## 7. Role-Access Matrix

| Role | Full Permission Set | Restricted To |
|------|-------------------|---------------|
| `super_admin` | All 17 permissions | Everything |
| `admin` | 16 permissions (no `settings_manage`) | R18-R23, user management, reconciliation |
| `forensic_analyst` | 11 permissions (no user/settings/audit) | R18 (no), R19-R21 (yes), forensic operations |
| `security_reviewer` | 4 permissions (read + alert_manage) | Read-only + alerts |
| `sandbox_operator` | 4 permissions (read + sandbox) | Reading evidence + sandbox operations |
| `auditor` | 4 permissions (read + audit_view) | Read-only + audit logs |

### Page Access by Role

| Page | super_admin | admin | forensic_analyst | security_reviewer | sandbox_operator | auditor |
|------|:-----------:|:-----:|:----------------:|:-----------------:|:----------------:|:-------:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Investigations | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Investigation Detail | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Evidence | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Alerts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sandbox | ✓ | ✓ | ✓ | | ✓ | |
| AI Analysis | ✓ | ✓ | ✓ | | | |
| Telemetry | ✓ | ✓ | ✓ | | ✓ | |
| Reports | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Settings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Audit Logs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Evidence Artifacts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| System Health | ✓ | ✓ | | | | |
| Blockchain Ops | ✓ | ✓ | ✓ | | | |
| Chain of Custody | ✓ | ✓ | ✓ | | | |
| Threat Intel | ✓ | ✓ | ✓ | | | |
| Forensic Analytics | ✓ | ✓ | | | | |
| Users | ✓ | ✓ | | | | |

---

## 8. Coverage Identifiers

Every trackable element in the frontend gets a unique Coverage ID (prefix + number). Use these when instructing Stitch to ensure no element is missed.

### Screen IDs (SP = Screen Public, SA = Screen Authenticated, SR = Screen Role-restricted)

| ID | Screen | Notes |
|----|--------|-------|
| SP01 | LoginPage | 2 states (login, success), error/loading |
| SP02 | RegisterPage | 4-step animated flow, 17 state vars |
| SP03 | ForgotPasswordPage | 4-step flow, OTP cooldown |
| SP04 | ManifestoPage | Fully static |
| SP05 | DiscoverPage | Fully static |
| SA01 | EnhancedDashboardPage | 5 KPI tiles, 2 empty states |
| SA02 | InvestigationsPage | Create modal, pagination, context menu |
| SA03 | InvestigationDetailPage | 5 tabs, note modal, escalate |
| SA04 | EvidenceExplorerPage | Detail panel, verify/delete workflow |
| SA05 | AlertsPage | Context menu per alert, detail modal |
| SA06 | LiveTelemetryPage | WebSocket, auto-scroll, pause/resume |
| SA07 | SandboxDashboardPage | 1274 lines, 5 tabs, 9 effects, runtime lifecycle |
| SA08 | AIAnalysisPage | 1513 lines, 7 tabs, 4 modes, 5 stores |
| SA09 | ReportsPage | Detail modal with 4 tabs, 3 export formats |
| SA10 | LogsPage | 2 views (audit/system), auto-refresh, 11 state vars |
| SA11 | EvidenceArtifactsPage | Detail/JSON toggle, blockchain indicators |
| SA12 | SettingsPage | 5 tab sections, 20+ form fields |
| SR01 | SystemHealthPage | 6 service checks, SVG ring gauges |
| SR02 | BlockchainOperationsPage | Delegates to 2 child panels |
| SR03 | ChainOfCustodyPage | Timeline, blockchain explorer link |
| SR04 | ThreatIntelligencePage | Canvas force-directed graph, IOC table |
| SR05 | ForensicAnalyticsPage | MITRE matrix grid, clickable cells |
| SR06 | UsersPage | CRUD modals, search, pagination |

### Component IDs (C = Component)

| ID | Component | Props | States |
|----|-----------|-------|--------|
| C01 | Button | 7 variants, 4 sizes, loading, icons, fullWidth | default, hover, active (scale), disabled, loading |
| C02 | Card + Header/Content/Footer | 5 variants, 4 paddings, hover | default, hover (y-shift) |
| C03 | StatusBadge / SeverityBadge / CountBadge | status/severity/count, size, dot, pulse, icon | 12 status colors, 5 severity colors, 3 count variants |
| C04 | Input / Textarea | label, error, helperText, leftIcon, rightIcon, fullWidth | default, focus, error, disabled |
| C05 | Select | label, error, helperText, options, placeholder, fullWidth | default, focus, error |
| C06 | Modal | isOpen, onClose, title, 4 sizes | open (animated), closed |
| C07 | StatusBanner | status (5 types), onDismiss | info/success/warning/error/loading, slideDown animation |
| C08 | Sidebar | collapsed, onToggle | expanded (260px), collapsed (72px) |
| C09 | Header | breadcrumbs[], currentPage | sticky |
| C10 | ConnectionStatus | — | connected/disconnected |
| C11 | PublicLayout | children | — |
| C12 | DashboardGrid / DashboardCard / DashboardStat / DashboardList / DashboardChart | span, rowSpan, hover, onChange, renderItem | default, hover, list items with status |
| C13 | BlockchainOperationsPanel | — | 3 tabs, each with data/loading/empty/error states |
| C14 | ReconciliationPanel | — | issues list, filters, resolve modal, empty |
| C15 | AnalysisResultCard | analysis data | score display |
| C16 | DocumentAnalysisView | document analysis | sections, indicators |
| C17 | UrlAnalysisView | URL analysis | reputation, redirects |
| C18 | ThreatSummaryBar | summary data | metrics bar |
| C19 | IocPanel | IOCs | table |
| C20 | AttackChain | chain stages | connected nodes visualization |
| C21 | EvidenceGraph | evidence relationships | network graph |
| C22 | MITREHeatmap | MITRE data | heatmap matrix |
| C23 | RiskScoreGauge | score | gauge visualization |
| C24 | Visualization Index | — | re-exports |
| C25 | ErrorBoundary | — | error state with fallback |
| C26 | AuthLoadingScreen | — | spinner + branding |
| C27 | ThreatMapCanvas | nodes, edges | physics simulation, color-coded |

### Form IDs (F = Form)

| ID | Form | Fields | Modals? |
|----|------|--------|---------|
| F01 | Login | email, password | No |
| F02-F05 | Register (4 steps) | role, email, OTP (6), name+password | No |
| F06-F08 | Forgot Password (3 steps) | email, OTP (6), password+confirm | No |
| F09 | Create Investigation | title, description, priority select | Yes (modal) |
| F10 | Add Note | type select, content textarea | Yes (modal) |
| F11-F15 | Settings (5 tabs) | 20+ fields across VM/Monitoring/Execution/Logging/Notifications | No |
| F16 | Evidence Lookup | evidenceIdInput | No |
| F17-F19 | User CRUD | name, email, password, role, department | Yes (3 modals) |
| F20-F29 | Filter bars (10) | search inputs, selects, checkboxes | No |

### Store IDs (S = Store)

| ID | Store | Lines | Actions | Key Data |
|----|-------|-------|---------|----------|
| S01 | useAuthStore | 167 | 7 | auth, tokens, permissions |
| S02 | useAlertStore | 130 | 5 | alerts, pagination |
| S03 | useEvidenceStore | 143 | 7 | evidence, blockchain bridge |
| S04 | useInvestigationStore | ~70 | 5 | investigations |
| S05 | useBlockchainStore | 918 | 40+ | blockchain, sync, worker, reconciliation |
| S06 | useAnalysisStore | 246 | 13 | AI analysis, comparison, live |
| S07 | useSandboxStore | ~200 | 9 | sandbox sessions, runtime |
| S08 | useTelemetryStore | ~80 | 5 | live telemetry stream |
| S09 | useLogsStore | ~90 | 6 | logs, auto-refresh |
| S10 | useReportsStore | ~90 | 5 | forensic reports |
| S11 | useSettingsStore | ~100 | 5 | app settings |
| S12 | useThreatIntelStore | ~60 | 2 | threat intel data |
| S13 | useTimelineStore | ~40 | 2 | timeline events, notes |
| S14 | useRealtimeStore | ~20 | 0 | socket connection state |
| S15 | useStatusStore | ~30 | 2 | global status messages |
| S16 | useThemeStore | ~30 | 2 | dark/light (dead code) |

### API Endpoint IDs (API = Backend API)

| ID | Method | Path | Purpose |
|----|--------|------|---------|
| API01 | POST | /api/v1/auth/login | Login |
| API02 | POST | /api/v1/auth/register | Register |
| API03 | POST | /api/v1/auth/send-otp | Send OTP |
| API04 | POST | /api/v1/auth/verify-otp | Verify OTP |
| API05 | POST | /api/v1/auth/forgot-password | Request password reset |
| API06 | POST | /api/v1/auth/verify-reset-otp | Verify reset OTP |
| API07 | POST | /api/v1/auth/reset-password | Reset password |
| API08 | POST | /api/v1/auth/logout | Logout |
| API09 | GET | /api/v1/auth/me | Get current user |
| API10 | POST | /api/v1/auth/refresh | Refresh token |
| API11 | GET | /api/v1/users | List users |
| API12 | POST | /api/v1/users | Create user |
| API13 | GET | /api/v1/users/:id | Get user |
| API14 | PUT | /api/v1/users/:id | Update user |
| API15 | DELETE | /api/v1/users/:id | Delete user |
| API16 | GET | /api/v1/investigations | List investigations |
| API17 | GET | /api/v1/investigations/stats | Investigation stats |
| API18 | POST | /api/v1/investigations | Create investigation |
| API19 | GET | /api/v1/investigations/:id | Get investigation |
| API20 | PUT | /api/v1/investigations/:id | Update investigation |
| API21 | DELETE | /api/v1/investigations/:id | Delete investigation |
| API22 | GET | /api/v1/investigations/:id/forensic-report | Get forensic report |
| API23 | GET | /api/v1/evidence | List evidence |
| API24 | POST | /api/v1/evidence/upload | Upload evidence |
| API25 | GET | /api/v1/evidence/investigation/:investigationId | Evidence by investigation |
| API26 | GET | /api/v1/evidence/:id | Get evidence |
| API27 | POST | /api/v1/evidence/:id/verify | Verify evidence |
| API28 | DELETE | /api/v1/evidence/:id | Delete evidence |
| API29 | GET | /api/v1/alerts | List alerts |
| API30 | GET | /api/v1/alerts/:id | Get alert |
| API31 | POST | /api/v1/alerts/:id/acknowledge | Acknowledge alert |
| API32 | POST | /api/v1/alerts/:id/resolve | Resolve alert |
| API33 | GET | /api/v1/sandbox/sessions | List sessions |
| API34 | POST | /api/v1/sandbox/sessions/start | Start session |
| API35 | POST | /api/v1/sandbox/sessions/:id/stop | Stop session |
| API36 | GET | /api/v1/sandbox/stats | Sandbox stats |
| API37 | GET | /api/v1/sandbox/health | Sandbox health |
| API38 | GET | /api/v1/sandbox/simulators | List simulators |
| API39 | GET | /api/v1/sandbox/monitoring/status | Monitoring status |
| API40 | GET | /api/v1/sandbox/execution/status | Execution status |
| API41 | GET | /api/v1/sandbox/monitoring/:sessionId | Session monitoring |
| API42 | DELETE | /api/v1/sandbox/sessions | Clear sessions |
| API43 | GET | /api/v1/reports | List reports |
| API44 | GET | /api/v1/reports/:id | Get report |
| API45 | GET | /api/v1/reports/:id/export/:format | Export report |
| API46 | GET | /api/v1/settings | Get settings |
| API47 | PUT | /api/v1/settings | Update settings |
| API48 | POST | /api/v1/settings/reset | Reset settings |
| API49 | GET | /api/v1/logs | List system logs |
| API50 | GET | /api/v1/logs/stats | Log stats |
| API51 | GET | /api/v1/logs/audit | List audit logs |
| API52 | GET | /api/v1/logs/audit/stats | Audit stats |
| API53 | GET | /api/v1/ai/health | AI service health |
| API54 | GET | /api/v1/ai/analyze/session/:id | Analyze session |
| API55 | POST | /api/v1/ai/compare | Compare sessions |
| API56 | GET | /api/v1/ai/patterns | Behavioral patterns |
| API57 | POST | /api/v1/ai/anomalies | Detect anomalies |
| API58 | GET | /api/v1/ai/insights | Correlation insights |
| API59 | GET | /api/v1/ai/clusters | Investigation clusters |
| API60 | GET | /api/v1/blockchain/status | Blockchain status |
| API61 | GET | /api/v1/blockchain/verification/stats | Verification stats |
| API62 | POST | /api/v1/blockchain/evidence/verify | Verify evidence on chain |
| API63 | POST | /api/v1/blockchain/evidence/batch-verify | Batch verify |
| API64 | POST | /api/v1/blockchain/evidence/register | Register evidence |
| API65 | POST | /api/v1/blockchain/package/create | Create evidence package |
| API66 | POST | /api/v1/blockchain/package/verify | Verify package |
| API67 | GET | /api/v1/blockchain/audit | List audit log |
| API68 | POST | /api/v1/blockchain/audit/record | Record audit entry |
| API69 | GET | /api/v1/blockchain/audit/evidence/:id | Evidence audit |
| API70 | GET | /api/v1/blockchain/integrity/:id | Integrity records |
| API71 | GET | /api/v1/blockchain/alerts | Tamper alerts |
| API72 | POST | /api/v1/blockchain/alerts/:evidenceId/:alertId/acknowledge | Acknowledge tamper alert |
| API73 | GET | /api/v1/blockchain/verification/history/:id | Verification history |
| API74 | POST | /api/v1/blockchain/hash/generate | Generate hash |
| API75 | POST | /api/v1/blockchain/hash/verify | Verify hash |
| API76 | POST | /api/v1/blockchain/contract/register | Register on contract |
| API77 | POST | /api/v1/blockchain/contract/verify | Verify on contract |
| API78 | GET | /api/v1/blockchain/contract/evidence/:id | Get contract evidence |
| API79 | GET | /api/v1/blockchain/contract/exists/:id | Check contract evidence |
| API80 | GET | /api/v1/blockchain/transactions | List transactions |
| API81 | GET | /api/v1/blockchain/transactions/stats | Transaction stats |
| API82 | POST | /api/v1/blockchain/transactions/:id/retry | Retry transaction |
| API83 | GET | /api/v1/blockchain/explorer/tx/:hash | Explorer URL |
| API84 | GET | /api/v1/blockchain/sync/status | Sync status |
| API85 | POST | /api/v1/blockchain/sync/queue | Queue for sync |
| API86 | POST | /api/v1/blockchain/sync/process | Process sync queue |
| API87 | POST | /api/v1/blockchain/sync/retry | Retry failed sync |
| API88 | GET | /api/v1/blockchain/sync/consistency/:id | Check consistency |
| API89 | GET | /api/v1/blockchain/worker/status | Worker status |
| API90 | POST | /api/v1/blockchain/worker/job | Create verification job |
| API91 | GET | /api/v1/blockchain/worker/job/:id | Get job status |
| API92 | POST | /api/v1/blockchain/worker/job/:id/cancel | Cancel job |
| API93 | POST | /api/v1/blockchain/reconciliation/run | Run reconciliation |
| API94 | GET | /api/v1/blockchain/reconciliation/issues | List issues |
| API95 | POST | /api/v1/blockchain/reconciliation/issues/:id/resolve | Resolve issue |
| API96 | GET | /api/v1/blockchain/reconciliation/stats | Reconciliation stats |
| API97 | GET | /api/v1/blockchain/state | Blockchain state |
| API98 | GET | /api/v1/blockchain/state/health | Health metrics |
| API99 | POST | /api/v1/blockchain/tamper/record | Record tamper detection |
| API100 | POST | /api/v1/evidence/artifacts | List artifacts |
| API101 | GET | /api/v1/evidence/artifacts/:id | Get artifact |
| API102 | GET | /api/v1/custody/integrity-stats | Integrity stats |
| API103 | GET | /api/v1/custody/alerts | Custody alerts |
| API104 | GET | /api/v1/custody/chain/:evidenceId | Custody chain |
| API105 | GET | /api/v1/threat/iocs | Threat IOCs |
| API106 | GET | /api/v1/threat/analysis | Threat analysis |
| API107 | GET | /api/v1/analytics/dashboard | Analytics dashboard |
| API108 | GET | /api/v1/sync/status | Sync status |
| API109 | GET | /api/v1/operations/health | Operations health |
| API110 | GET | /api/v1/analysis | Analysis data |

### Workflow IDs (W = Workflow)

| ID | Workflow | Steps | Screens Involved |
|----|----------|-------|------------------|
| W01 | Login | 2-4 steps | SP01 |
| W02 | Registration | 5 steps | SP02 |
| W03 | Password Reset | 5 steps | SP03 |
| W04 | Session Auth Check | 4 steps | App startup |
| W05 | Token Refresh | 4 steps | App-wide |
| W06 | Create Investigation | 4 steps | SA02 |
| W07 | View Investigation | 2 steps | SA02 → SA03 |
| W08 | Escalate Investigation | 1 step | SA03 |
| W09 | Add Note | 3 steps | SA03 |
| W10 | Upload Evidence | 3 steps | SA04 |
| W11 | Verify Evidence | 3 steps | SA04 |
| W12 | Delete Evidence | 2 steps | SA04 |
| W13 | Blockchain Sync Ops | 3 tabs, 3 actions | SR02, C13 |
| W14 | Reconciliation | 4 steps | SR02, C14 |
| W15 | Evidence Custody Trace | 4 steps | SR03 |
| W16 | Start Runtime | 1 step + poll | SA07 |
| W17 | Sandbox Session Lifecycle | 5+ steps | SA07 |
| W18 | Session Forensic Analysis | 3 steps | SA08 |
| W19 | Live Analysis | 3 steps | SA08 |
| W20 | Session Comparison | 3 steps | SA08 |
| W21 | Document/URL Analysis | 2 steps | SA08 |
| W22 | Live Telemetry | 3 steps | SA06 |
| W23 | View & Export Reports | 4 steps | SA09 |
| W24 | Update Settings | 4 steps | SA12 |
| W25 | CRUD Users | 4 CRUD operations | SR06 |
| W26 | System Health Check | 1 step + poll | SR01 |
| W27 | Audit Log Review | 4 steps | SA10 |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Routes (unique paths) | 24 |
| Public screens | 5 |
| Authenticated screens | 12 |
| Role-restricted screens | 6 |
| Lazy-loaded pages | 7 |
| Eager-loaded pages | 16 |
| UI primitive components | 7 |
| Layout components | 4 |
| Enterprise grid components | 6 |
| Blockchain components | 2 |
| Threat intel components | 5 |
| Visualization components | 5 |
| Infrastructure components | 3 |
| Zustand stores | 16 |
| API service methods | 40+ |
| Forms (input) | 19 |
| Filter bars | 10 |
| Backend API endpoints | 110+ |
| Workflows | 27 |
| Zustand state fields | 200+ |
| Total frontend TypeScript | ~20,000 lines |
| Backend TypeScript | ~15,000+ lines |
