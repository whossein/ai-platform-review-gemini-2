# Phase 2 Completion Report: Agent Decoupling

**Date:** 2026-09-07  
**Version:** 0.1.9  
**Status:** ✅ Complete

---

## Objective

Decouple specialist agents from the Orchestrator by moving agent registration to the composition root (server entry points) and making the review pipeline accept a pre-populated `AgentRegistry` instead of instantiating agents internally.

---

## Changes Made

### 1. **Pipeline Signature Update**

**File:** `packages/orchestrator/src/pipeline.ts`

- Changed `runReview()` signature to accept `AgentRegistry` as the first parameter
- Removed direct imports of `SPECIALISTS`, `makeSpecialistDefinition`, `makeSpecialistHandler`
- Removed internal agent registration loop
- Updated JSDoc to clarify that the registry must be pre-populated by the caller

**Before:**
```typescript
export async function runReview(
  opts: RunOptions,
  extraProviders?: readonly LLMProvider[]
): Promise<ReviewResult>
```

**After:**
```typescript
export async function runReview(
  registry: AgentRegistry,
  opts: RunOptions,
  extraProviders?: readonly LLMProvider[]
): Promise<ReviewResult>
```

### 2. **Server Composition Root**

**File:** `server.ts`

- Added agent registry creation at startup in `startServer()`
- Registered all specialists from `SPECIALISTS` array before starting the HTTP server
- Updated `/api/estimate` endpoint to use `agentRegistry.list()` instead of mapping `SPECIALISTS`
- Updated `/api/review` endpoint to pass `agentRegistry` as the first argument to `runReview()`

### 3. **API Server Composition Root**

**File:** `apps/api/src/server.ts`

- Created `createAgentRegistry()` helper function to encapsulate agent registration logic
- Updated `handleEstimate()` to create and use a local registry instance
- Updated `handleReview()` to create and use a local registry instance
- Both handlers now pass the registry to their respective operations

### 4. **Test Refactoring**

**File:** `packages/orchestrator/src/orchestrator.test.ts`

- Extracted agent registration into a reusable `createTestRegistry()` helper
- Updated test suite to use the helper function
- Added `runReview({ registry })` override so tests can inject fully custom registries
- Added a new test proving the orchestrator executes a completely generic,
  made-up agent definition (no `SPECIALISTS` involved) end-to-end — the core
  Phase 2 acceptance criterion from the roadmap

### 5. **Cleanup & Verification Fixes** (follow-up pass, 2026-09-14)

- Removed stale `packages/orchestrator/src/orchestrator.ts.bak`
- Exported `FileRuleContext` from `@ai-review/orchestrator` (re-exported from
  `@ai-review/config`) so `estimate.ts` compiles
- Fixed `exactOptionalPropertyTypes` violations in `apps/api` handlers
  (`test-provider.ts`, `models.ts`, `review.ts`)
- Verified: `turbo run typecheck` (29/29 tasks), full production build, and
  orchestrator tests 18/18 pass

---

## Verification

### Typecheck
✅ All packages pass TypeScript compilation:
```bash
npx turbo run typecheck --filter=@ai-review/orchestrator --filter=@ai-review/api
```

### Tests
✅ Orchestrator tests pass (18/18):
- `critic.test.ts`: 5 passed
- `planner.test.ts`: 5 passed
- `orchestrator.test.ts`: 8 passed (incl. generic-agent decoupling test)

Note: `apps/api/src/server.test.ts` (4 tests) could not be executed in this
environment — the sandbox blocks binding a local port (`listen EPERM`). The test
file and handlers typecheck cleanly; run it in an unrestricted environment to
confirm.

### Build
✅ Full production build succeeds

---

## Impact

- ✅ **Dependency Inversion:** The orchestrator no longer knows about concrete agent implementations
- ✅ **Composition Root:** All specialist registration happens at application startup, not inside the pipeline
- ✅ **Testability:** Tests can now inject mock registries without depending on `SPECIALISTS`
- ✅ **Extensibility:** New agents can be registered by the caller without modifying the orchestrator
- ✅ **Adherence to PHASE-2-PLAN:** All objectives met

---

## Next Steps

Phase 2 is complete. The project is ready for:

- **Phase 3:** Thin Server Boundary (extract route handlers, reduce `server.ts` from 560 lines to ~120 lines)
- **Phase 4:** Implement Real Tool & Skill Capabilities
- **Phase 5:** Durable Memory (persistent storage)

---

## References

- [PHASE-2-PLAN.md](./PHASE-2-PLAN.md) — Original phase 2 design document
- [ARCHITECTURE-ROADMAP.md](./ARCHITECTURE-ROADMAP.md) — Overall roadmap
- [ARCHITECTURE-AUDIT.md](./ARCHITECTURE-AUDIT.md) — Initial audit
