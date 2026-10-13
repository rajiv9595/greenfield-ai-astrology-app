# Decisions

## ADR-001: Start as a modular monolith

**Status:** Accepted for Phase 1.

Use Next.js and TypeScript as a single web product. Do not introduce microservices until measured scaling, isolation, or deployment requirements justify them.

## ADR-002: Preserve calculation and narration boundaries

**Status:** Accepted for Phase 1.

The future deterministic calculation engine will be isolated from AI narration. Models may request typed evidence but will never write canonical chart data.
