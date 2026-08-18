# Architecture Audit

## 1. Current Architecture

The system is structured as a monorepo with 18 packages under `packages/` and a central HTTP server (`server.ts`). The architecture follows a modular monolith approach, intending to strictly separate domain interfaces (`@ai-review/core`) from implementations.

## 2. Actual vs Intended Dependency Graph

### Intended

- `server.ts` depends purely on `orchestrator`, `config`, and `core` interfaces.
- `orchestrator` dynamically executes `agents` (discovered via plugins/registry).
- `agents` leverage `skills` and `tools` through the `agent-runtime` bounding box.
- Abstractions are injected via Dependency Injection (DI).

### Actual

- `server.ts` (605 lines) acts as a God Object, orchestrating HTTP parsing, environment setup, and directly importing internals from `@ai-review/llm`, `@ai-review/git`, `@ai-review/orchestrator`, and `fs/promises`.
- `@ai-review/orchestrator` has a hard dependency on agent business logic (`packages/orchestrator/src/agents.ts`), tightly coupling the execution engine to the specific "Specialist" domain implementations.
- `runReview` inside `orchestrator` violates dependency inversion by manually instantiating concrete classes (`new DefaultContextEngine()`, `new CheapestFirstRouter()`, `new MockLLMProvider()`).

## 3. Abstraction Gaps & Problematic Coupling

1. **Concrete Implementations Leaking**: Specialist agents live inside the orchestrator instead of a standalone `plugins` or `agents` package.
2. **Missing Dependency Inversion**: The orchestrator does not accept its core engines (Context, LLM, Memory) as injected dependencies, severely hindering testability and modularity.
3. **Thick Controller**: The API route (`/api/review`) in `server.ts` handles complex HTTP logic, GitLab token resolution, file system access, and payload mapping, completely bypassing bounded contexts.

## 4. Scaffolded Components & Pretending Abstractions

- **`@ai-review/skills`**: Contains exactly one hardcoded/mocked skill (`contributingComplianceSkill`) and is otherwise a placeholder.
- **`@ai-review/tools`**: Completely empty placeholder (`export {}`).
- **`@ai-review/prompts`**: Completely empty placeholder (`export {}`).
- **`@ai-review/ui`**: Completely empty placeholder (`export {}`).
- **`@ai-review/memory`**: Implemented solely as an `InMemoryMemoryStore` (a JavaScript `Map`). It pretends to be a persistent memory store but loses all data across restarts.

## 5. Recommended Implementation Order

1. **Phase 1: Orchestrator Dependency Inversion** (Extract concrete instantiations).
2. **Phase 2: Decouple Agents** (Extract `agents.ts` out of `orchestrator`).
3. **Phase 3: Thin Server** (Extract business orchestration out of `server.ts`).
4. **Phase 4: Tool & Skill Implementations** (Replace scaffolds with working tools).
5. **Phase 5: Persistent Memory** (Replace the in-memory map with a durable store).
