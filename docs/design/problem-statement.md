# Problem Statement

## The Problem

Digital forensics investigations are undermined by a fundamental trust gap: once
evidence is collected, there is no reliable way to prove it has **not been
altered** — by an attacker, by an investigator's mistake, or by the very tools
used to analyze it. Traditional approaches rely on:

- **Manual chain-of-custody paperwork** — error-prone, easily lost, and
  impossible to audit after the fact.
- **Centralized databases** — a single point of compromise; a database
  administrator (or attacker) can silently rewrite records.
- **Unverifiable analysis** — forensic conclusions are often presented without
  a reproducible link back to the original artifact and the tooling that
  examined it.

## Target User

A **digital forensics analyst / investigator** who needs to:

1. Collect and store artifacts (files, telemetry, sandbox outputs) in a
   structured case.
2. Prove the integrity of every artifact at any point in time.
3. Demonstrate tamper-evidence when an artifact *has* been modified.
4. Combine manual analysis with automated (AI-assisted) threat classification
   and sandbox-based behavioral analysis.
5. Present all of the above in an auditable, role-controlled workflow.

## Constraints

- **Educational / research scope** — the platform simulates malware behavior in
  a controlled sandbox for teaching forensic analysis; it does not detonate
  real malware on production infrastructure.
- **No containerization** — the sandbox executes inside VirtualBox VMs, which
  prevents Docker-based packaging of the full stack.
- **Local-first deployment** — all five services run on a developer machine or
  lab host; the blockchain component uses a local development node.
- **Real-time awareness** — investigators expect live status (sessions,
  events, alerts) without manual refresh.

## Goals

1. **Integrity first** — every evidence artifact is hashed (SHA-256) and its
   hash anchored on a blockchain, producing an immutable, queryable proof of
   state.
2. **Demonstrable tamper detection** — the platform can detect, record, and
   restore tampered artifacts, with each transition persisted and audited.
3. **Full investigation workflow** — from evidence intake through analysis
   (AI classification, sandbox behavioral runs) to reports, with chain of
   custody tracked end-to-end.
4. **Role-controlled access** — six RBAC roles govern what each actor can
   view, create, verify, or delete.
5. **Auditability** — every significant action is written to an audit log and
   (where relevant) to the blockchain audit trail.

## Non-Goals

- Not a production DFIR suite (e.g., no memory forensics, no disk imaging).
- Not a public blockchain deployment; the contract runs on a local Hardhat node.
- Not a malware-detection product; the sandbox simulates scenarios for
  teaching and demonstration.
- No multi-tenant SaaS concerns (single organization, local deployment).