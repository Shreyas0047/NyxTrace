# NyxTrace Stitch Design Brief

> Complete specification for generating every screen, component, form, state, and workflow via Stitch MCP.
> Target: 100% coverage — no placeholder screens, no missing states.

---

## 1. Visual Identity & Theme

### Brand
- **Name:** NyxTrace — AI-Powered Cybercrime Forensic Platform
- **Tagline:** "Cyber Intelligence"
- **Tone:** Industrial, editorial, forensic — warm dark, precise typography, no glassmorphism

### Color Palette (dark mode only; light mode is dead code)

| Token | Hex | Usage |
|-------|-----|-------|
| `--surface-base` | `#0a0a0a` | Primary background (near-black) |
| `--surface-sunken` | `#0d0d0d` | Sidebar background |
| `--surface-elevated` | `#1a1a1a` | Card backgrounds |
| `--surface-overlay` | `#222222` | Modal/hover surfaces |
| `--border-subtle` | `rgba(255,255,255,0.06)` | Dividers, borders |
| `--border-default` | `rgba(255,255,255,0.10)` | Active borders |
| `--text-primary` | `#ebe8e3` | Primary text (warm off-white) |
| `--text-secondary` | `#a09b93` | Secondary/muted text |
| `--text-tertiary` | `#6c6862` | Placeholder, disabled |
| `--accent-amber` | `#f59e0b` | Primary accent (active links, buttons) |
| `--accent-amber-subtle` | `rgba(245,158,11,0.08)` | Active nav background |
| `--accent-cyan` | `#06b6d4` | Secondary accent |
| `--severity-critical` | `#ef4444` | Critical alerts |
| `--severity-high` | `#f97316` | High alerts |
| `--severity-medium` | `#eab308` | Medium alerts |
| `--severity-low` | `#10b981` | Low alerts |

### Background Texture
- Subtle CSS dot-grid overlay via `body::before` pseudo-element (1px dots, rgba(255,255,255,0.02), 24px spacing)

### Typography
- **Display:** `"Inter", system-ui, sans-serif` — font-display
- **Body:** `"Inter", system-ui, sans-serif`
- **Monospace:** `"JetBrains Mono", "Fira Code", Consolas, monospace` — for hashes, IDs, JSON previews, logs
- **Overscription:** `9px` uppercase letter-spaced — for section labels, overlines
- **Scale:** 10/12/13/14/15/18/24/30/36/48px

### Shapes
- **Cards:** `rounded-xl` (12px)
- **Buttons:** `rounded-lg` (8px)
- **Inputs:** `rounded-lg` (8px)  
- **Modals:** `rounded-2xl` (16px)
- **Badges:** `rounded-full` (pill)
- **Sidebar nav:** `rounded-md` (6px)

### Shadows
- **Cards:** `0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)`
- **Elevated:** `0 4px 6px rgba(0,0,0,0.4)`
- **Modals:** `0 25px 50px rgba(0,0,0,0.5)`
- **Amber glow:** `0 0 20px rgba(245,158,11,0.15)`
- **Red glow:** `0 0 20px rgba(239,68,68,0.15)`

### Animation
- **Page transitions:** 250ms, cubic-bezier(0.4, 0, 0.2, 1), 8px y-offset
- **Card entrance:** 200ms fadeIn + 5px y-offset
- **Modal entrance:** 200ms fadeIn backdrop + 200ms scale(0.95→1) + slideUp(20px→0)
- **Sidebar collapse:** 240ms, cubic-bezier(0.16, 1, 0.3, 1)
- **Active nav rail:** layout animation with 200ms spring
- **Loading spinners:** 1s linear infinite rotation
- **Pulsing indicators:** 2s cubic-bezier animation for active/live states

### Sidebar Brand
- Logo: Fingerprint icon in amber gradient (`#f59e0b → #b45309`)
- Amber box-shadow on logo: `0 1px 3px rgba(245, 158, 11, 0.25)`

---

## 2. Layout Architecture

### Application Shell
```
┌─────────────────────────────────────┐
│ Sidebar (fixed left)    │ Header    │
│ ───                     │ (sticky)  │
│ Brand logo              │           │
│                         │ Breadcrumb│
│ Navigation sections     │ trail     │
│ ───                     │           │
│ Collapse footer         ├───────────┤
│                         │           │
│                         │ <Outlet />│
│                         │ (animated)│
│                         │           │
│                         │           │
└─────────────────────────────────────┘
```

- **Sidebar:** 244px expanded, 72px collapsed (icons only)
- **Content area:** `margin-left: 244px` (or 72px when collapsed)
- **Header:** sticky top, breadcrumb trail, page title
- **Global status bar:** below header, StatusBanner component

### Sidebar Navigation Structure (4 sections, 16 items)

| Section | Items |
|---------|-------|
| **Workspace** | Dashboard, Investigations, Evidence, Alerts |
| **Operations** | Sandbox, Telemetry, AI Analysis, Reports |
| **Intelligence** | Threat Intel, Forensic Analytics, Chain of Custody, Blockchain Ops |
| **Administration** | System Health, Users, Settings, Audit Log |

- Active item: amber accent dot rail (left border), amber icon, `rgba(245,158,11,0.08)` background
- Inactive item: `#6c6862` icon, `#a09b93` text, hover → `#ebe8e3` text
- Section labels visible only when expanded, use `overline` class (9px uppercase)

---

## 3. Screen Specifications

### 3.1 — Public Screens (5)

#### SP01 — LoginPage (`/login`)
**Layout:** `PublicLayout` (centered card, dark asset pattern background)
**States:** login form → success animation
**Elements:**
- NyxTrace logo (Fingerprint amber gradient) with "NyxTrace" + "Cyber Intelligence" tagline
- Email input with left icon (Mail)
- Password input with left icon (Lock) + right toggle (Eye/EyeOff)
- "Forgot password?" link (right-aligned, subtle)
- "Login" button (amber gradient, full-width)
- Loading state: spinner replaces button text
- Error state: animated banner above form (red bg, AlertCircle icon, message text)
- Success state: full-screen "Welcome back" animation → 1.5s delay → redirect
- Bottom link: "Don't have an account?" → `/register`
- Backdrop: subtle CSS dot-grid on `#0a0a0a` bg

#### SP02 — RegisterPage (`/register`)
**Layout:** `PublicLayout`
**4-step animated flow** (AnimatePresence slide transitions):
1. **Role Selection:** 2 large cards (Analyst icon, Administrator icon) with radio-card selection
2. **Email Entry:** email input + "Request Access Code" button
3. **OTP Verification:** 6 individual digit inputs (auto-advance on type, max 1 char each, paste support), "Verify Code" button, "Request New Code" link with cooldown countdown
4. **Password Setup:** First Name + Last Name inputs, Password + Confirm Password inputs, show/hide toggle, "Establish Identity" button

**States per step:** loading (spinner on button), error (text below form), cooldown (timer display)
**Bottom link:** "Already have an account?" → `/login`

#### SP03 — ForgotPasswordPage (`/forgot-password`)
**Layout:** `PublicLayout`
**4-step animated flow:**
1. **Email:** email input + "Send Verification Code"
2. **OTP:** 6 digit inputs (same behavior as register), "Verify Code", "Resend" with cooldown
3. **Password Reset:** New password + Confirm, show/hide toggle, "Reset Password"
4. **Success:** checkmark animation + "Back to Login"

**Back link:** "Back to Login" → `/login`

#### SP04 — ManifestoPage (`/manifesto`)
**Layout:** `PublicLayout`
**Fully static.** Team section (2 members), Ethics (7 items), Principles (4 items). No forms, no state.

#### SP05 — DiscoverPage (`/discover`)
**Layout:** `PublicLayout`
**Fully static.** 6 feature cards (Sandbox Analysis, Blockchain Evidence, Forensic Analytics, Threat Intelligence, Chain of Custody, Live Telemetry), 5 architecture layers. "Sign In" + "Create Account" buttons linking to `/login` and `/register`.

### 3.2 — Authenticated Screens (12)

#### SA01 — EnhancedDashboardPage (`/dashboard`)
**Layout:** `PageContainer` with `PageGrid` (4 cols)
**Title:** "Operations Dashboard"
**Elements:**
- **5 KPI tiles** (DashboardGrid + DashboardStat format):
  - Investigations (Search icon, navy accent) → `/investigations`
  - Active Alerts (Bell icon, red accent for critical count)
  - Evidence (Folder icon, green accent)
  - Sandbox (Terminal icon, cyan accent for active sessions)
  - Threat Intel (AlertTriangle icon, amber accent)
- **Recent Investigations** section (3-item list, each clickable → `/investigations/{id}`)
  - Empty state: "No investigations yet — Create your first case →"
- **Recent Alerts** section (3-item list)
  - Empty state: "No alerts to display"
- **Action buttons:** "New Investigation" → `/investigations`, "Reports" → `/reports`

#### SA02 — InvestigationsPage (`/investigations`)
**Layout:** `PageContainer` with `PageHeader`
**Title:** "Investigations"
**Actions:** "New Investigation" button (opens create modal)
**Filters:** Search input, Status select (5), Priority select (5)
**Data display:** 3-column card grid
  - Each card: caseNumber badge, title, description (2-line clamp), StatusBadge, SeverityBadge, evidenceCount, alertCount, updatedAt (relative time), context menu (MoreVertical → "View Details", "Delete")
**States:** loading (spinner), error (dismissible banner), empty (illustration + "New Investigation" button)
**Modals:**
  - **Create:** Title input, Description textarea, Priority select (4), Cancel + Create buttons
  - **Delete:** Confirmation dialog

#### SA03 — InvestigationDetailPage (`/investigations/:id`, lazy)
**Layout:** `PageContainer` with back-to-investigations link
**5 tabs:**
1. **Overview:** Status + Priority badges, description, assigned analysts list, metadata grid
2. **Evidence:** (placeholder for evidence list)
3. **Timeline:** events list or empty state "No timeline events yet"
4. **AI Analysis:** link to AI analysis page
5. **Notes:** notes list by type (color-coded: observation, finding, conclusion, remediation, escalation), "Add Note" button

**Workflow buttons:** "Escalate to Critical", "Add Evidence" (placeholder), "Add Note"
**Note modal:** type select (5), content textarea, loading state, Cancel + Add buttons
**States:** loading (spinner), not found (back button), error (dismissible banner), empty notes

#### SA04 — EvidenceExplorerPage (`/evidence`)
**Layout:** Split-panel (list left, detail right)
**Title:** "Evidence Explorer"
**Filters:** Search input, Type select (8), Status select (3)
**Stats bar:** Total size, Verified count, Analyzing count
**List:** evidence items with name, type, status, size, relative time, tags, blockchain indicator
  - Selected item highlighted
**Detail panel:** full evidence details, tags, hash info, chain of custody, analysis summary
  - "Select an evidence item to view details" prompt when nothing selected
**Actions per item:** Verify (only if not verified), Delete (with confirm), View (placeholder), Download (placeholder)
**States:** loading (spinner), error (banner with dismiss), empty (illustration)

#### SA05 — AlertsPage (`/alerts`)
**Layout:** `PageContainer` with `PageGrid`
**Title:** "Alert Management"
**Filters:** Search input, Severity select (5), Status select (5)
**Data display:** List of alert cards
  - Each card: severity icon (colored), title, alertId, description, relative time, source, SeverityBadge, StatusBadge, MoreVertical menu
**Context menu:** "View Details", "Acknowledge" (if new), "Resolve" (if not resolved)
**Detail modal:** Full alert data, MITRE techniques (if present), acknowledge/resolve flows
**Resolve form:** Summary text, Action Taken text, Resolve button
**States:** loading (spinner), error (banner), empty ("All clear — No alerts to display")

#### SA06 — LiveTelemetryPage (`/telemetry`)
**Layout:** `PageContainer` with `PageGrid`
**Title:** "Live Telemetry"
**Controls:** Pause/Resume (Play/Pause icon toggle), Clear button, Auto-scroll toggle (ArrowUp/Down)
**Filters:** Type select (6 categories), Source select (5 sources)
**Data display:** Scrolling event stream (auto-scroll to bottom)
  - Each event: timestamp, category icon (colored), event_type, JSON data preview
  - Latest event: pulsing dot + "Latest" badge
  - Hover: expanded JSON detail
**Connection indicator:** green/red dot in header
**States:** empty ("Waiting for forensic events..."), connected/disconnected indicator
**Empty:** "No telemetry events received yet. Start a sandbox session to generate events."

#### SA07 — SandboxDashboardPage (`/sandbox`, lazy)
**Layout:** `PageContainer` with `PageHeader`
**Title:** "Sandbox Console"
**5 tabs:** Sessions, Monitoring, Timeline, Telemetry, Logs

**Runtime status:** "Start Runtime" button (when offline) / "Runtime Online" badge (green, when running)
**Active session banner:** animated gradient banner, elapsed time (live counter), session ID, Stop button, Terminate button
**Session states:** running (animated), completed (green badge), timeout/interrupted (amber), failed (red)

**Sessions tab:**
  - Simulator selector (dropdown), New Session button, Clear Sessions button
  - Status filter, Simulator filter
  - Session list cards: session_id, simulator, status badge, start time, duration, events count
  - Detail panel on select: full session info, error box if failed

**Monitoring tab:** metrics dashboard or "No monitoring data" empty state

**Timeline tab:** session timeline with events

**Telemetry tab:** real-time event stream (same pattern as LiveTelemetryPage), pause/resume, auto-scroll, connection dot

**Logs tab:** log entries with search, level filter, auto-refresh interval, export (download .txt), copy to clipboard, auto-scroll

#### SA08 — AIAnalysisPage (`/ai-analysis`, lazy)
**Layout:** `PageContainer` with `PageHeader`
**Title:** "AI Analysis Engine"
**4 mode tabs:** Sandbox, Document, URL Intel, Workspace

**Sandbox mode:**
- Session selector (dropdown), "Analyze Session" button
- Live analysis: gradient banner, event count, Stop button
- "Compare Sessions" button → compare modal (session checkboxes, max 2)
- Stored analysis banner: "Previous analysis found" + "Re-analyze" button

**7 analysis tabs:**
1. **Overview:** Threat classification card, severity gauge, key metrics grid
2. **Threat Classification:** classification percentages, confidence score
3. **MITRE ATT&CK:** mapped techniques grid (expandable)
4. **Attack Chain:** AttackChain visualization component
5. **Heuristics:** triggered behavioral heuristics list
6. **Anomalies:** anomaly cards with severity colors
7. **Comparison:** side-by-side session comparison

**Document mode:** DocumentAnalysisView component
**URL Intel mode:** UrlAnalysisView component
**Workspace mode:** (placeholder)

**States:** loading, error toast (fixed bottom-right), empty per tab, stored analysis found/not found

#### SA09 — ReportsPage (`/reports`, lazy)
**Layout:** `PageContainer` with `PageHeader`
**Title:** "Forensic Reports"
**Filters:** Search (debounced), Simulator select (6), Severity select (5)
**Data display:** report cards grid
  - Each card: simulator name, date, event count, severity counts, file size, blockchain indicator
**Pagination:** when totalPages > 1
**Detail modal:** 4 tabs
  - **Timeline:** start/end time, duration, status
  - **Events:** per-category lists (process, file, registry, network, behavior, system)
  - **Suspicious:** suspicious activities with severity badges
  - **Summary:** risk score, events collected, integrity info, hashes
**Export buttons in modal:** PDF, JSON, TXT
**States:** loading (spinner), error (retry button), empty (illustration)

#### SA10 — LogsPage (`/audit`, lazy)
**Layout:** `PageContainer` with `PageHeader`
**Title:** "Audit Log"
**View toggle:** Audit / System (pill tabs)
**Controls (both views):** Refresh button, Export button (system), Auto-refresh toggle + interval selector (3s/5s/10s/30s), Clear button
**Filters (audit):** Search (debounced), Action select (10), Status select (3)
**Filters (system):** Search (debounced), Level select (5), Category select (8)
**Data display:** log/audit entry rows, expandable (shows JSON details)
**Auto-scroll:** bottomRef for real-time additions
**Stats (audit):** 4 stat cards — Total, byAction, byStatus
**Stats (system):** 4 stat cards — by level distribution
**States:** loading (spinner), error (retry button), empty ("No log entries"), auto-refresh pulsing dot

#### SA11 — EvidenceArtifactsPage (`/evidence-artifacts`, lazy)
**Layout:** Split-panel (artifact list left, detail right)
**Title:** "Evidence Artifacts"
**Filters:** Search (debounced 300ms), Category select (10), Source select (4)
**Pagination:** page/limit/total
**Data display:** artifact list with name, category, source, timestamp, blockchain indicator (green dot if verified, checkmark if confirmed)
  - Selected artifact highlighted  
**Detail panel:** full artifact detail, event relationships, timeline events
  - View mode toggle: Detail / JSON
  - JSON mode: raw JSON viewer with "Copy" button
  - Detail mode: formatted fields, relationships graph, timeline
  - "Download" button → JSON file download
**States:** loading (spinner), error (Retry button), empty (guidance text), detail loading, no selection prompt

#### SA12 — SettingsPage (`/settings`)
**Layout:** `PageContainer` with `PageHeader`
**Title:** "Settings"
**5 tab sections** (pill tabs): VM, Monitoring, Execution, Logging, Notifications
**Message card:** shows success/error messages with icons
**Form per tab:**
- **VM:** VM Name, Snapshot Name, Startup Timeout (number), Shutdown Timeout (number), Headless Mode (checkbox)
- **Monitoring:** Enable Monitoring (checkbox), Polling Interval (number), Log Retention Days (number), 5 target checkboxes (process/file/registry/network/behavior)
- **Execution:** Timeout (number), Max Concurrent Sessions (number), Telemetry Limit (number), Auto Rollback (checkbox)
- **Logging:** Log Level select (5), Max File Size select, Max Files (number)
- **Notifications:** Enable Alerts (checkbox), Alert on Completion (checkbox), Alert on Error (checkbox), Webhook URL (url)
**Actions:** "Save Changes" (amber gradient, disabled when no changes), "Reset to Defaults" (ghost button)
**States:** loading (spinner), saving (button loading), validation errors list, success/error message

### 3.3 — Role-Restricted Screens (6)

#### SR01 — SystemHealthPage (`/health`, lazy)
**Layout:** `PageContainer` with `PageHeader`
**Title:** "System Health"
**Access:** admin, super_admin
**Service list:** 6 service checks (Sandbox Runtime, Backend API, MongoDB, Blockchain, AI Analysis Engine, Simulator Catalog)
  - Each: service name, status dot (green/amber/red), response time, last check timestamp
**System metrics:** Inline SVG ring gauges for CPU, Memory, Storage
**Active connections:** count display
**Refresh button:** triggers all checks
**States:** loading (spinner), all healthy (green), degraded (amber + issue count), error (red + error list)

#### SR02 — BlockchainOperationsPage (`/blockchain-operations`)
**Layout:** `PageContainer` with `PageHeader`
**Title:** "Blockchain Operations"
**Access:** admin, super_admin, forensic_analyst
**Offline banner:** amber when blockchain unavailable
**Contains two panels:**
1. **BlockchainOperationsPanel** — 3 tabs (Sync, Worker, Health)
   - Sync: health badge, 4 stat cards (Pending, Failed, Total Synced, On Chain), queue status (5 metrics), timestamps, 3 action buttons
   - Worker: 5 stat cards (Total Jobs, Queued, Processing, Completed, Failed), priority distribution, empty state
   - Health: score/100, status badge, 4 metric cards, issues list / healthy message
   - 30s auto-refresh
2. **ReconciliationPanel** (admin only)
   - "Run Full Reconciliation" button
   - 5 stat cards (Total, Critical, High, Resolved Today, Auto-Resolved)
   - Severity filter + "Show Resolved" checkbox
   - Issues list with severity coloring, type labels, resolve button per issue
   - Resolve modal: textarea + Cancel/Resolve

#### SR03 — ChainOfCustodyPage (`/chain-of-custody`)
**Layout:** `PageContainer` with `PageHeader`
**Title:** "Chain of Custody"
**Access:** admin, super_admin, forensic_analyst
**Top stat cards:** 5 integrity stats (Total Evidence, Verified, Modified, Pending, On-chain)
**Evidence lookup:** text input + "Trace" button (Enter key support)
**Search error:** red text below input
**Custody timeline:** chronological events with icons (CheckCircle for verified, Clock for pending, AlertTriangle for tamper)
  - Hover on verified event → tooltip with txHash
  - "VERIFIED" badge with hover tooltip
  - "View on Explorer" link → `{blockchainExplorerUrl}/tx/{txHash}` in new tab
**Tamper alerts section:** alert list or "No tamper alerts" message

#### SR04 — ThreatIntelligencePage (`/threat-intelligence`)
**Layout:** `PageContainer` with `PageHeader`
**Title:** "Threat Intelligence"
**Access:** admin, super_admin, forensic_analyst
**Force-directed graph:** Canvas-based (ThreatMapCanvas inline component)
  - Physics simulation (repulsion, attraction, center gravity, bounds)
  - Node pulsing animation
  - Color-coded by severity (red ≥ 70, amber ≥ 40, cyan < 40)
  - Glow effects on nodes
**IOC Table:** 5 columns (Indicator value, Type, Severity badge, Score progress bar)
  - Sorted by first 20 IOCs
**States:** loading (full-page spinner), graph rendered / empty, IOC table rendered / empty

#### SR05 — ForensicAnalyticsPage (`/forensic-analytics`)
**Layout:** `PageContainer` with `PageHeader`
**Title:** "Forensic Analytics"
**Access:** admin, super_admin
**Top stat cards:** 4 analytic metrics from API
**MITRE ATT&CK Matrix:** Interactive grid (11 tactics × 28 techniques)
  - Clickable cells with glow effects
  - Technique expand/collapse → detail panel (AnimatePresence)
**Correlation insights:** list when >0, hide when empty
**States:** loading (full-page spinner), data loaded, technique detail panel open/closed

#### SR06 — UsersPage (`/users`)
**Layout:** PageContainer with PageHeader
**Title:** "User Management"
**Access:** admin, super_admin
**Search:** debounced 300ms, search icon
**Pagination:** 10 per page, prev/next with "Page X of Y"
**Data table:**
  - Column: User (name + email), Role (colored badge with Shield icon), Department, Created date, Actions (Edit/Delete buttons)
  - Delete button hidden for self
**Modals:**
  - **Create:** Name, Email, Password, Role select (4 roles + descriptions), Department, Cancel + Create
  - **Edit:** same fields, Password optional, Cancel + Update
  - **Delete:** confirmation text, Cancel + Delete
**States:** loading ("Loading users..."), error (banner), empty ("No users found"), CRUD modal open/closed

---

## 4. Cross-Screen Patterns

### Data Tables / Lists
- Consistent row height (48-56px)
- Hover state: `rgba(255,255,255,0.02)` background
- Selected state: `rgba(245,158,11,0.05)` amber tint
- Border between rows: `rgba(255,255,255,0.04)`
- Expandable rows: chevron rotation animation

### Status & Severity Badges
- **StatusBadge:** dot + label, colors map to 12 status values
- **SeverityBadge:** filled pill, 5 levels (critical=red, high=orange, medium=yellow, low=emerald, info=sky)
- **CountBadge:** rounded pill, 3 variants (default/primary/danger), max 99 → "99+"
- All animations: fadeIn + scaleIn

### Empty States
- Centered layout, icon in 64px rounded square (slate-800 bg)
- Title (text-lg font-medium), description (text-sm, max-w-sm), optional action button
- Used consistently across all data-display screens

### Loading Spinners
- `Loader2` icon from lucide-react, 24px, `animate-spin`
- Centered for full-page loads, inline for section loads

### Error States
- Animated banner (StatusBanner) for top-level errors
- Inline red text for form field errors
- Retry buttons for API errors
- Full-page "not found" for missing resources

### Modal Patterns
- Backdrop: `bg-slate-900/50 backdrop-blur-sm`, click-to-close
- Content: white/dark-slate-800, rounded-2xl, shadow-2xl
- Title bar: border-b, close button (X icon with hover)
- 4 sizes: sm (max-w-md), md (max-w-lg), lg (max-w-2xl), xl (max-w-4xl)
- Animation: scale + slideUp on enter, reverse on exit

### Pagination
- Simple prev/next with page indicator
- "Page X of Y" format
- Disabled state on first/last page
- 10-12 items per page by default

---

## 5. Real-time & Live Data Patterns

### WebSocket-Indicator Pattern
- Green dot = connected, Red dot = disconnected
- Used in: LiveTelemetryPage, SandboxDashboardPage (telemetry + logs tabs)
- Size: 6px circle, with pulse when connected

### Auto-scroll Pattern
- Container ref + bottom ref for scroll anchoring
- Toggle button (ArrowUp = scroll to top, ArrowDown = scroll to bottom)
- Used in: LiveTelemetryPage, SandboxDashboardPage (telemetry + logs), LogsPage
- Active state: blue highlight on scroll-to-bottom button

### Auto-refresh Pattern
- Toggle switch + interval selector (3/5/10/30s)
- Pulsing green dot when active
- Used in: SandboxDashboardPage (logs tab), LogsPage

### Live Session Banner
- Animated gradient background (amber/cyan sweep)
- Elapsed time counter (MM:SS format)
- Session ID display
- Stop/Terminate buttons
- Used in: SandboxDashboardPage, AIAnalysisPage

---

## 6. Form Element Specifications

### Input
- bg: `#1a1a1a` (elevated), text: `#ebe8e3`
- Border: `rgba(255,255,255,0.10)`, focus: `#06b6d4` (cyan)
- Error: red border + AlertCircle icon + red helper text
- Padding: `px-3 py-2`, font-size: `14px`
- Placeholder: `#6c6862`
- leftIcon + rightIcon support (absolute positioned)

### Select
- Same visual as Input + custom chevron-down icon
- `appearance-none` with custom dropdown arrow
- Placeholder option auto-inserted if not present in options
- onChange returns value string directly

### Textarea
- Same visual as Input + `resize-y min-h-[80px]`
- Label + error/helper text below

### Checkbox
- Custom dark checkbox `rounded` style
- Label right-aligned, text-sm

### Buttons
| Variant | Visual |
|---------|--------|
| primary | Amber gradient (`#f59e0b → #d97706`), white text, amber focus ring |
| secondary | Cyan gradient (`#06b6d4 → #0891b2`), white text, cyan focus ring |
| solid | Slate-700 bg, slate-200 text, border |
| outline | Transparent, slate-200 text, slate-600 border, hover slate-800 |
| ghost | Transparent, slate-300 text, hover slate-800 |
| danger | Red gradient (`#ef4444 → #dc2626`), white text, red focus ring |
| success | Emerald gradient (`#10b981 → #059669`), white text, emerald focus ring |

- Sizes: xs (26px), sm (32px), md (38px), lg (44px)
- Loading state: Loader2 spinner replaces content
- Hover: scale(0.95) on active press
- Disabled: opacity-50, cursor-not-allowed

### Interactive Navigation (Sidebar)
- Active: amber left rail (layout animation), amber icon, `rgba(245,158,11,0.08)` bg, `#ebe8e3` text
- Inactive: `#6c6862` icon, `#a09b93` text
- Hover: `#ebe8e3` text
- Collapsed: 72px, icons only + tooltips on hover
- Section labels visible when expanded, `overline` style (9px uppercase)

---

## 7. Visualization Components

These are existing React components that need to be rendered within the designed screens. They should be placed in designated card/panel slots with appropriate spacing and sizing.

| Component | Screen(s) | Slot |
|-----------|-----------|------|
| AttackChain | AIAnalysisPage (Attack Chain tab) | Full-width card |
| EvidenceGraph | AIAnalysisPage | Card within analysis view |
| MITREHeatmap | AIAnalysisPage (MITRE tab) | Full-width card |
| RiskScoreGauge | AIAnalysisPage (Overview) | Small stat card |
| ThreatMapCanvas | ThreatIntelligencePage | Hero panel (above IOC table) |
| SVG Ring Gauges | SystemHealthPage | System metrics section |

---

## 8. Design System Token Mapping

### Tailwind v4 Theme Block (excerpt from `src/index.css`)

```css
@theme {
  --color-surface-base: #0a0a0a;
  --color-surface-sunken: #0d0d0d;
  --color-surface-elevated: #1a1a1a;
  --color-surface-overlay: #222222;
  --color-border-subtle: rgba(255,255,255,0.06);
  --color-border-default: rgba(255,255,255,0.10);
  --color-text-primary: #ebe8e3;
  --color-text-secondary: #a09b93;
  --color-text-tertiary: #6c6862;
  --color-accent-amber: #f59e0b;
  --color-accent-cyan: #06b6d4;
  --color-severity-critical: #ef4444;
  --color-severity-high: #f97316;
  --color-severity-medium: #eab308;
  --color-severity-low: #10b981;
}
```

### Stitch Design System Configuration

When creating/updating the Stitch design system, use:
- **Color mode:** Dark
- **Seed color:** `#f59e0b` (amber)
- **Override primary:** `#f59e0b`
- **Override neutral:** `#a09b93`
- **Body font:** Inter
- **Headline font:** Inter
- **Label font:** Inter (or not set)
- **Roundness:** ROUND_EIGHT (8px) with full (9999px) for badges
- **Design MD:** Include the full visual identity section from this brief

---

## 9. Stitch Project Structure Plan

### Phase 1: Design System
1. Create project "NyxTrace Forensic Platform"
2. Create/update design system with dark theme, amber seed, Inter font

### Phase 2: Screen Generation (23 screens)
Generate each screen with the Coverage IDs from the inventory:

**Batch A — Public:**
1. SP01 — LoginPage (2 states: form, success)
2. SP02 — RegisterPage (4-step flow)
3. SP03 — ForgotPasswordPage (4-step flow)
4. SP04 — ManifestoPage (static)
5. SP05 — DiscoverPage (static)

**Batch B — Core Authenticated:**
6. SA01 — EnhancedDashboardPage (5 KPIs, 2 section lists)
7. SA02 — InvestigationsPage (card grid, create modal)
8. SA03 — InvestigationDetailPage (5 tabs, note modal)
9. SA04 — EvidenceExplorerPage (split panel, filters)
10. SA05 — AlertsPage (list, context menu, detail modal)

**Batch C — Operations:**
11. SA06 — LiveTelemetryPage (event stream, real-time)
12. SA07 — SandboxDashboardPage (5 tabs, runtime lifecycle)
13. SA08 — AIAnalysisPage (4 modes, 7 analysis tabs, 4 viz components)
14. SA09 — ReportsPage (card grid, detail modal with 4 tabs)
15. SA10 — LogsPage (2 views, auto-refresh, expandable rows)

**Batch D — Specialized:**
16. SA11 — EvidenceArtifactsPage (split panel, detail/JSON toggle)
17. SA12 — SettingsPage (5 form tabs, save/reset)

**Batch E — Role-restricted:**
18. SR01 — SystemHealthPage (6 service checks, ring gauges)
19. SR02 — BlockchainOperationsPage (2 panels, 3 tabs each)
20. SR03 — ChainOfCustodyPage (timeline, lookup, stats)
21. SR04 — ThreatIntelligencePage (force graph, IOC table)
22. SR05 — ForensicAnalyticsPage (MITRE matrix, insights)
23. SR06 — UsersPage (data table, 3 CRUD modals)

### Phase 3: Component Library (29 components)
Generate designs for each component with all variants and states.

### Phase 4: Workflow Validation
Validate each of the 27 workflows against generated screens.

---

## 10. Critical Design Notes

1. **No light mode support** — All designs must be dark-only
2. **No glassmorphism** — Use solid surfaces with subtle borders
3. **No placeholder content** — Every design must show realistic data shape
4. **All states required** — Every screen must show loading, empty, error, and populated states
5. **Consistent spacing** — Use 24px page padding, 24px section gaps, 16px card gaps
6. **Dot-grid background** — Subtle overlay on `#0a0a0a` base
7. **Animations are essential** — Page transitions (250ms), card entrance (200ms), modal (200ms)
8. **Blockchain indicators** — Green dot + checkmark for blockchain-verified items
9. **Severity colors are semantic** — Used consistently across all badges, borders, and icons
10. **Warm text hierarchy** — `#ebe8e3` primary, `#a09b93` secondary, `#6c6862` tertiary

---

## 11. Non-Stitch Implementation Notes

The following aspects are handled in code (not Stitch designs) and should be represented as static design elements:

- **CSS dot-grid background** — Static background texture
- **Animated transitions** — Represent as motion arrows between screen states
- **WebSocket real-time updates** — Represent as "LIVE" indicators on relevant screens
- **Zustand state management** — Represent as state labels on screens (loading/error/empty/populated)
- **Role-based rendering** — Annotate which elements are visible to which roles
- **Blockchain verification flow** — Represent as a sequential flow diagram if needed

---

*End of Design Brief. Total screens: 23. Total components: 29+. Total workflows: 27. Target: 100% Stitch coverage.*
