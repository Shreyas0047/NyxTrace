# Requirements

Requirement IDs are referenced from the report and the test suites
(`backend/src/tests/routes/*.test.ts`, `ai-service/app/tests/`,
`blockchain/test/`).

## Functional Requirements

### Identity & Access (FR-AUTH)

| ID | Requirement |
|----|-------------|
| FR-AUTH-01 | Users register with email + password and verify their account. |
| FR-AUTH-02 | Authentication issues JWT access tokens with a refresh-token flow. |
| FR-AUTH-03 | Six RBAC roles exist: `super_admin`, `admin`, `forensic_analyst`, `security_reviewer`, `sandbox_operator`, `auditor`. |
| FR-AUTH-04 | Role changes are guarded: a user can only be assigned a role equal to or below the assigner's own rank, and can only manage users of strictly lower rank. |
| FR-AUTH-05 | Every sensitive action (login, user changes, role changes, deletes) is written to the audit log. |

### Evidence Lifecycle (FR-EV)

| ID | Requirement |
|----|-------------|
| FR-EV-01 | An investigator can upload an evidence artifact to an investigation; the file is stored on disk and a metadata record (name, type, source, size, mime) is persisted. |
| FR-EV-02 | The platform computes a SHA-256 hash of the artifact content. |
| FR-EV-03 | The hash is anchored on the blockchain (`EvidenceRegistry#registerEvidence`) and the transaction is stored locally (`BlockchainVerification`). |
| FR-EV-04 | An artifact can be verified at any time; verification recomputes the hash and compares it against the anchored hash and the stored hash. |
| FR-EV-05 | A mismatch transitions the artifact to `tampered` and records the observed hash (`tamperedHash`). |
| FR-EV-06 | A tamper event can be recorded on-chain (`EvidenceRegistry#recordTamperDetection`) for immutable evidence of the tamper. |
| FR-EV-07 | A tampered artifact can be restored to its original content; the record returns to `verified`. |
| FR-EV-08 | Verification, tamper, and restore operations are idempotent (repeatable without duplicate blockchain records). |

### Chain of Custody (FR-CO)

| ID | Requirement |
|----|-------------|
| FR-CO-01 | Every custody hand-off, access, and modification is appended to an append-only custody chain for the artifact. |
| FR-CO-02 | Evidence lineage (parent/child artifacts) is tracked and queryable. |

### Sandbox Analysis (FR-SB)

| ID | Requirement |
|----|-------------|
| FR-SB-01 | An operator can start a sandbox session against a chosen simulator (LockByte, HiveMind, VaultDrain, SilentEye, GhostKernel, NetWarp, Wraith). |
| FR-SB-02 | The sandbox agent drives the VM through REVERT → BOOT → STAGE → EXECUTE → OBSERVE → COMPLETE and streams live logs over WebSocket. |
| FR-SB-03 | Forensic telemetry events produced during execution are synced to the backend and stored as `TelemetryEvent` records. |
| FR-SB-04 | Sessions retain execution summaries, extracted IOCs, and per-session AI analysis. |
| FR-SB-05 | Sessions are resilient: 409-style conflicts surface correctly, and a completed session reports its collected event count. |

### AI-Assisted Analysis (FR-AI)

| ID | Requirement |
|----|-------------|
| FR-AI-01 | Telemetry from investigations can be analyzed for threat classification, MITRE mapping, attack chain, severity, and narrative. |
| FR-AI-02 | Analysis is dual-gated: an LLM primary path (structured single-call JSON via Ollama) when enabled, with a deterministic heuristic pipeline as fallback (feature extraction + Z-score anomaly detection always run first). |
| FR-AI-03 | Alerts can be enriched and investigations summarized; executive reports can be generated. |
| FR-AI-04 | Results are cached (LRU, configurable TTL) and rate-limited per client IP. |

### Blockchain Integrity (FR-BC)

| ID | Requirement |
|----|-------------|
| FR-BC-01 | The `EvidenceRegistry` contract stores evidence hash → (timestamp, owner) and tamper records. |
| FR-BC-02 | The backend synchronizes on-chain state into local collections and runs a verification worker to re-check integrity periodically. |
| FR-BC-03 | If the blockchain node is unavailable, the platform degrades to offline mode rather than failing hard. |
| FR-BC-04 | Contract calls are resumable: re-anchoring the same evidence is an upsert, not a duplicate. |

### Reports & Alerts (FR-RE / FR-AL)

| ID | Requirement |
|----|-------------|
| FR-RE-01 | Reports can be created per investigation with executive summary, findings, and optional AI analysis; versioned and published. |
| FR-AL-01 | Alerts are generated from analysis/anomaly detection with severity and status workflow. |

### Operations (FR-OP)

| ID | Requirement |
|----|-------------|
| FR-OP-01 | System health, storage usage, and live logs are exposed for operators. |
| FR-OP-02 | Knowledge base articles support the analyst workflow (guides, references, tutorials). |
| FR-OP-03 | Analytics aggregates (daily summaries, investigation metrics) are computed for dashboards. |

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | **Integrity** — evidence hashes are anchored on-chain; local tampering of storage is detectable by re-verification. |
| NFR-02 | **Availability** — all external dependencies (blockchain node, LLM backend, sandbox VM) are optional at runtime; the platform degrades gracefully. |
| NFR-03 | **Auditability** — audit log covers auth, user management, evidence lifecycle, and role changes; blockchain audit trail complements it. |
| NFR-04 | **Security** — passwords hashed (bcrypt), JWT auth, permission checks per route, sensitive fields excluded from API responses. |
| NFR-05 | **Performance** — AI responses cached; telemetry ingestion is batched; frontend lazy-loads non-critical pages. |
| NFR-06 | **Testability** — backend has unit/route tests (Jest), AI service has pytest suites, contract has Hardhat tests; CI runs build checks for all services. |