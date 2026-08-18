# Architecture Roadmap

This roadmap defines a strictly ordered series of implementation phases to harden the existing architectural abstractions.
**Rules for all phases:**

- No new features.
- Preserve existing external behavior.
- Every phase must be independently testable.
- Strictly respect boundaries (only allowed files may change).

---

## Phase 1: Orchestrator Dependency Inversion

**Responsibility:** Remove concrete class instantiations from the Orchestrator, enabling true dependency injection.
**Allowed Packages to Change:** `@ai-review/orchestrator`, `server.ts`
**Tasks:**

- Refactor `runReview` and the Orchestrator constructor to accept `ContextEngine`, `WorkflowEngine`, `LLMClient`, and `MemoryStore` as injected dependencies via an `OrchestratorContext` or factory.
- Move the concrete instantiation logic (`new DefaultContextEngine()`, `new CachingLLMClient()`, etc.) up to `server.ts` (the composition root).
- **Required Tests:** Update `orchestrator.test.ts` to supply mock implementations of the engines, proving that the orchestrator is fully decoupled from concrete engines.

## Phase 2: Decouple Agents from Orchestrator

**Responsibility:** Move specialist agent business logic out of the orchestration engine.
**Allowed Packages to Change:** `@ai-review/orchestrator`, `@ai-review/agent-runtime`, `server.ts`, (and optionally a new `packages/plugins/reviewers` if created).
**Tasks:**

- Extract `packages/orchestrator/src/agents.ts` into its own domain package (e.g., `@ai-review/plugins` or `@ai-review/agents`).
- Inject the `AgentRegistry` into the orchestrator instead of having the orchestrator hard-link the `SPECIALISTS` array.
- Register the agents in `server.ts` and pass the populated registry into the orchestrator.
- **Required Tests:** Verify that the orchestrator can execute a completely generic agent definition without knowing about "Security" or "Performance" specifically.

## Phase 3: Thin out the Server Boundary (Composition Root Refactor)

**Responsibility:** Remove orchestration, token resolution, and filesystem logic from the Express server routes.
**Allowed Packages to Change:** `server.ts`, `@ai-review/api` (if extracted), or `@ai-review/orchestrator`.
**Tasks:**

- Extract the 600+ lines of `server.ts` into a clean `AppFactory` or `ReviewController` class.
- Move environment validation and Git token resolution into a dedicated configuration step (using `@ai-review/config`).
- **Required Tests:** Unit test the HTTP route controllers by passing mock Request/Response objects, verifying that they correctly format the output of the Orchestrator without executing business logic.

## Phase 4: Implement Real Tool/Skill Capabilities

**Responsibility:** Replace scaffolded tools and skills with the real underlying implementations required by the agent runtime.
**Allowed Packages to Change:** `@ai-review/tools`, `@ai-review/skills`, `@ai-review/agent-runtime`.
**Tasks:**

- Implement real `Skill` interfaces in `@ai-review/skills` rather than the single dummy string-matching `contributingComplianceSkill`.
- Define standard AST or file-read tools in `@ai-review/tools`.
- Bind these implemented capabilities into the `DefaultAgentRuntime`.
- **Required Tests:** Test each tool/skill execution independently against a dummy `ContextSlice`.

## Phase 5: Durable Memory

**Responsibility:** Replace the placeholder `InMemoryMemoryStore` with a persistent abstraction.
**Allowed Packages to Change:** `@ai-review/memory`, `server.ts`.
**Tasks:**

- Implement a `PersistentMemoryStore` (e.g., SQLite or File-system backed for this environment) conforming to the `MemoryStore` interface.
- Keep `InMemoryMemoryStore` for tests.
- Inject the persistent store in `server.ts`.
- **Required Tests:** Test that memory handles survive re-instantiation of the store (e.g., read/write persistence tests).
