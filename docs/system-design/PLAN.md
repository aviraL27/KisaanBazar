# KisaanBazaar System Design Plan

## 1. Objective
Produce an investor- and engineering-ready system design document for KisaanBazaar that is implementation-ready for V1 and extensible for advanced features.

## 2. Final Deliverables
1. Main design document with all 9 required parts.
2. TypeScript-first schema/interfaces for MongoDB models and API contracts.
3. Redis keyspace, commands, consistency, and failure strategy.
4. Mermaid diagrams:
   - High-level architecture (component/C4-style)
   - 5 critical path sequence diagrams
   - Auth flow sequence diagram
   - Scaling topology diagram
5. Deployment, observability, logging, and operations strategy.

## 3. Workspace Structure
- docs/system-design/
  - SYSTEM_DESIGN.md
  - PLAN.md
  - diagrams/
    - architecture.mmd
    - flow-1-fetch-prices.mmd
    - flow-2-add-listing.mmd
    - flow-3-place-order.mmd
    - flow-4-price-ingestion.mmd
    - flow-5-trending-crops.mmd
    - auth-flow.mmd
    - scaling-topology.mmd

## 4. Planning Principles
1. Opinionated choices only; no ambiguous alternatives in final design.
2. Explicit tradeoffs for consistency, latency, and reliability.
3. Quantified assumptions for scale, storage growth, memory, and throughput.
4. TypeScript strict-mode contracts for all snippets.
5. UI guidance: light theme, agriculture-oriented visual identity, minimal flash.

## 5. Scope & Decisions Locked Upfront
1. Core architecture: React SPA + Express API + MongoDB + Redis + Firebase Auth.
2. Communication: REST/JSON + Socket.IO typed events.
3. Caching strategy: read-through for prices/listings, event-driven invalidation, selective write-through.
4. Order integrity: MongoDB transactions + optimistic concurrency + idempotency key in Redis.
5. Price pipeline cadence: every 15 minutes with 30-second propagation target.

## 6. Version Policy
The prompt provided strict technologies and suggested versions. Final document will keep required technologies but recommend stable modern versions suitable for 2026 production baselines (without changing the stack).

## 7. Execution Plan (Phases)
1. Requirements decomposition and SLO mapping.
2. High-level architecture and interfaces between layers.
3. Low-level backend structure and module boundaries.
4. MongoDB schema, indexes, and growth estimates.
5. Redis deep design and command-level examples.
6. Critical-path sequence flows with failure handling.
7. Security, rate limiting, and data protection architecture.
8. Scaling triggers, topology, and operational gotchas.
9. Advanced feature hooks (ML, notifications, offline sync, i18n).
10. Monitoring, logging, and deployment blueprint.

## 8. Outputs by Next Step
Immediate next drafting step:
1. Create SYSTEM_DESIGN.md with section-by-section skeleton aligned to PART 1-9.
2. Populate PART 1 and PART 2 first with concrete metrics and architecture choices.
3. Add first Mermaid diagram file: architecture.mmd.
