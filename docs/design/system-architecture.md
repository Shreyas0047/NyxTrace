# System Architecture

## Services

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        FE["Frontend<br/>React 19 + Vite 8<br/>:5173"]
    end

    subgraph Core["Core Layer"]
        BE["Backend<br/>Express + Mongoose + Socket.IO<br/>:3000"]
        MONGO[("MongoDB<br/>Atlas / local")]
    end

    subgraph Intelligence["Intelligence Layer"]
        AI["AI Service<br/>FastAPI<br/>:8000"]
        OLLAMA["Ollama<br/>llama3.2"]
    end

    subgraph Ledger["Ledger Layer"]
        BC["Blockchain Node<br/>Hardhat<br/>:8545"]
        SC["EvidenceRegistry.sol"]
    end

    subgraph SandboxLayer["Sandbox Layer"]
        AGENT["Sandbox Agent<br/>FastAPI + VirtualBox<br/>:8765"]
        VM["ForensicsSandbox VM"]
    end

    FE -->|REST /api/v1 + WS| BE
    BE --> MONGO
    BE -->|analysis, enrich, summarize| AI
    AI --> OLLAMA
    BE -->|ethers v6| BC
    BC --> SC
    BE -->|session control + telemetry| AGENT
    AGENT -->|VirtualBox API| VM
```

## Port Map

| Service | Port | Entry |
|---------|------|-------|
| Backend | 3000 | `backend/src/index.ts` (ts-node-dev) |
| Frontend | 5173 | `frontend/src/main.tsx` (Vite dev server) |
| AI Service | 8000 | `ai-service/app/main.py` (uvicorn) |
| Blockchain | 8545 | `npx hardhat node` |
| Sandbox Agent | 8765 | `sandbox-agent-v2/main.py` |

## Core Spine — Evidence Integrity Flow

This is the central narrative of the platform: **collect → hash → anchor →
verify → detect → record → restore**. Every step is persisted and audited.

```mermaid
sequenceDiagram
    participant U as Analyst (Frontend)
    participant B as Backend
    participant F as File Storage
    participant C as Contract (Hardhat)
    participant M as MongoDB

    U->>B: Upload evidence (FR-EV-01)
    B->>F: Store artifact
    B->>M: Create evidence record (status=ready)
    B->>B: Compute SHA-256 (FR-EV-02)
    B->>C: registerEvidence(hash) (FR-EV-03)
    C-->>B: tx hash
    B->>M: Persist BlockchainVerification

    U->>B: Verify (FR-EV-04)
    B->>F: Re-read artifact
    B->>B: Recompute hash vs stored + anchored
    alt hash matches
        B->>M: status=verified
    else mismatch (FR-EV-05)
        B->>M: status=tampered, tamperedHash=new hash
        U->>B: Record tamper on-chain (FR-EV-06)
        B->>C: recordTamperDetection(hash)
        U->>B: Restore (FR-EV-07)
        B->>F: Restore original content
        B->>M: status=verified, tamperedHash cleared
    end
```

## Degradation Paths

The platform treats every external dependency as optional:

```mermaid
flowchart LR
    subgraph Failures["Failure Scenarios"]
        F1["Hardhat node down"]
        F2["Ollama / AI service down"]
        F3["Sandbox VM aborted / agent down"]
    end

    subgraph Responses["Platform Response"]
        R1["Offline blockchain mode —<br/>verification continues locally,<br/>anchoring deferred/queued (FR-BC-03)"]
        R2["Heuristic analysis fallback —<br/>feature extraction + Z-score anomaly<br/>detection (FR-AI-02)"]
        R3["Sandbox unavailable —<br/>skipped via SKIP_SANDBOX; sessions<br/>marked failed/timeout cleanly"]
    end

    F1 --> R1
    F2 --> R2
    F3 --> R3
```

## WebSocket Events

- `/logs/live` — sandbox pipeline logs streamed from the agent through the
  backend to the frontend.
- Backend socket namespace carries live telemetry, alert, and event counters
  shown in the header (`WS: LIVE · API: OK · EVT: n · ALR: n`).

## Request Flow (representative)

1. Frontend calls `http://localhost:5173` → Vite dev server proxies `/api` to
   `http://localhost:3000` and `/ws` to the backend socket.
2. Every API request carries a `X-Correlation-ID` header generated on the
   client, traced end-to-end across backend and sandbox agent logs.
3. Backend middleware: `authenticate` (JWT) → `authorize`/`requirePermission`
   (RBAC) → controller → service → model/blockchain/agent.
4. Responses are normalized in the API client (`_id` → `id`, computed display
   `name`) so the UI never touches Mongo internals.