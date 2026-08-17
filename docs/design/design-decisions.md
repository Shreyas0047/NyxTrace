# Design Decisions

Each decision records **Context** (what was considered), **Decision** (what
was chosen), and **Consequence** (what it costs / buys). These are the
questions an examiner or reviewer is most likely to probe.

---

## DD-01 — Local Hardhat node instead of a public testnet (Sepolia)

- **Context:** The contract must be demonstrable and deterministic in a lab.
  A public testnet adds faucet dependency, latency, and non-deterministic
  state; it also costs real (test) ETH setup friction for every environment.
- **Decision:** Run a local Hardhat node (chain ID 31337) with a fixed
  signer account and deploy `EvidenceRegistry` at a known address.
- **Consequence:** Immutability guarantees are *architecturally* real (the
  contract and flow are unchanged by network) but *operationally* local —
  chain state vanishes on node reset. The sync + verification worker layers
  are network-agnostic, so moving to Sepolia/mainnet is a configuration
  change, not a redesign.

## DD-02 — Five services instead of a monolith

- **Context:** The platform spans UI, business logic, AI inference, an
  immutable ledger, and VM orchestration. Each has different runtimes
  (Node vs Python vs Solidity) and different failure domains.
- **Decision:** Separate services: backend (Express), frontend (React),
  AI (FastAPI), blockchain (Hardhat), sandbox agent (FastAPI + VirtualBox),
  communicating over HTTP/WebSocket.
- **Consequence:** Clear ownership per service and independent degradation
  (see system-architecture degradation paths). Costs: five processes to run,
  two languages, and cross-service contract maintenance.

## DD-03 — MongoDB as the primary store

- **Context:** Evidence metadata, custody chains, telemetry events, and
  analytics are heterogeneous and schema-light; new fields are added
  frequently during development.
- **Decision:** MongoDB via Mongoose with 13+ models; fields normalized at
  the API boundary (`_id` → `id`).
- **Consequence:** Fast iteration and flexible nested documents (custody
  chains, AI analysis blocks). Trade-off: cross-document integrity is the
  application's responsibility (e.g., idempotent upserts for blockchain
  records).

## DD-04 — SHA-256 content hashing + on-chain anchoring

- **Context:** Integrity proof must be cheap, verifiable by any party, and
  resistant to collisions in scope.
- **Decision:** SHA-256 of artifact bytes is stored locally and anchored on
  the contract; verification recomputes and compares against both.
- **Consequence:** Tampering with storage is detectable without trusting the
  database — the on-chain hash is the source of truth. Hash-only anchoring
  (not storing content on-chain) keeps gas costs fixed and content private.

## DD-05 — Dual-gated LLM router with heuristic fallback

- **Context:** AI classification quality depends on a local LLM (Ollama) that
  may be absent, slow, or offline. The platform must still produce analysis.
- **Decision:** Feature extraction + Z-score anomaly detection always run as
  fast pre-processing; then, only if `AI_LLM_ENABLED=true` **and**
  `AI_LLM_PRIMARY_PATH=true`, a single structured Llama 3.2 call returns
  classification, MITRE mapping, attack chain, severity, and narrative in one
  JSON response. Any network error, invalid JSON, or disabled flag falls back
  to the heuristic pipeline.
- **Consequence:** Deterministic minimum behavior with optional quality
  uplift; the LLM is never a hard dependency.

## DD-06 — VirtualBox instead of containers

- **Context:** The sandbox executes simulated malware behaviors; containers
  do not provide the OS-level fidelity (or the teachable snapshot/revert
  workflow) desired.
- **Decision:** VirtualBox VMs with a snapshot baseline
  (`CleanBaselinePythonFixed`); the agent drives REVERT → BOOT → STAGE →
  EXECUTE → OBSERVE → COMPLETE per session.
- **Consequence:** Realistic behavioral fidelity and reversible sessions.
  Cost: no Docker packaging for the whole stack; the sandbox requires a
  VirtualBox-capable host.

## DD-07 — Idempotent blockchain registration

- **Context:** Network retries and user re-actions can re-anchor the same
  evidence, producing duplicate contract records (E11000 duplicate key).
- **Decision:** Registration flows use `findOneAndUpdate` upserts keyed on
  evidence hash; contract re-anchoring overwrites rather than duplicates.
- **Consequence:** Repeatable demo flows; at-most-once semantics per hash in
  local collections.

## DD-08 — Offline-first degradation for blockchain

- **Context:** Demos and lab sessions may start without the Hardhat node.
- **Decision:** Backend detects node availability and runs in offline mode:
  local verification continues, anchoring is deferred; a synchronization
  service reconciles queued work when the node returns.
- **Consequence:** The platform never hard-fails on the ledger being absent —
  at the cost of temporarily weaker integrity guarantees (clearly flagged in
  the UI).

## DD-09 — JWT access + refresh tokens with RBAC middleware

- **Context:** Six roles with different capabilities; tokens must be
  short-lived and refreshable without re-login.
- **Decision:** Short-lived access token + refresh token rotation; route
  guards via `authenticate` (JWT) and `requirePermission`/`authorize`
  (permission matrix per role).
- **Consequence:** Fine-grained control (e.g., admins cannot manage peers or
  self-demote via UI); requires careful guard placement in services as well
  as routes (defense in depth).

## DD-10 — Telemetry schema normalization at the boundary

- **Context:** The sandbox agent and the backend evolved independently; the
  agent emits `category`/`source_process` while the backend expected
  `eventType`/`processName` — producing `unknown` events silently.
- **Decision:** The sync service accepts aliases (`event.type ||
  eventType || event_type`, `processName` fallback) and normalizes at
  ingestion; historical records were backfilled.
- **Consequence:** Robust against agent schema drift; the mapping is the
  single place to change when either side evolves.

## DD-11 — Dev-mode OTP for demo flows

- **Context:** Demo logins need a friction-free OTP step.
- **Decision:** When `OTP_DEV_MODE=true`, the backend returns the OTP
  (`devOtp`) in the response instead of requiring an email/phone channel.
- **Consequence:** Fast demo onboarding; strictly a dev-mode flag — real
  OTP delivery is preserved when the flag is off.