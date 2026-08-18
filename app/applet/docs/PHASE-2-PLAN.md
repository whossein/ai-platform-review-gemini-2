# Phase 2 Plan: Decoupling Specialist Agents from the Orchestrator

## Analysis of Current Architecture

1. **How specialist agents are currently created:**
   - They are statically defined in an array `SPECIALISTS` (of type `SpecialistSpec`) located in `packages/orchestrator/src/agents.ts`.
   - The Orchestrator constructs them dynamically per-request using `makeSpecialistDefinition` and `makeSpecialistHandler`.

2. **Which parts of Orchestrator know concrete agent implementations:**
   - `packages/orchestrator/src/orchestrator.ts` directly imports `SPECIALISTS`, `makeSpecialistDefinition`, and `makeSpecialistHandler` from `./agents.ts`. It iterates over them and registers them itself.
   - `packages/orchestrator/src/planner.ts` relies on `SpecialistSpec` and hardcodes routing rules matching specific `focus` strings (e.g., `react`, `python`).

3. **What information the Orchestrator actually needs from an agent:**
   - The Planner needs to know which agents are available and their routing heuristics (to skip irrelevant ones).
   - The Orchestrator just needs an ID to tell the `AgentRuntime` to execute. It shouldn't care about prompts, definitions, or handlers.

4. **Whether an Agent interface already exists and whether it is sufficient:**
   - Yes. `@ai-review/core` defines `RegisteredAgent`, `AgentDefinition`, and `AgentHandler`. This contract is sufficient and properly abstracts the agent's logic.

5. **Whether Agent Runtime and SpecialistAgent responsibilities are currently separated correctly:**
   - The execution is separated (`AgentRuntime` executes the handler).
   - However, the *registration* and *creation* are currently bleeding into the Orchestrator. The Orchestrator should not be responsible for mapping `SpecialistSpec` to `AgentDefinition`.

6. **Whether a registry is actually necessary:**
   - Yes, and it already exists (`MapAgentRegistry` in `@ai-review/core`). The problem is `server.ts` passes an empty registry to the Orchestrator, and the Orchestrator populates it inline.

7. **Whether the existing plugins/skills architecture can be reused:**
   - The existing `RegisteredAgent` and `AgentRegistry` are exactly the abstraction meant for this (which also aligns with how plugins inject agents). We do not need a new abstraction (no `AgentFactoryFactory`).

8. **Which dependencies specialist agents currently receive:**
   - They receive an `AgentExecutionContext` (from `@ai-review/core`), which contains safe, capability-gated access to `llm`, `slice` (diff context), `memory`, `budget`, `tools`, and `skills`.

9. **Which tests depend on concrete agent implementations:**
   - `packages/orchestrator/src/planner.test.ts` imports `SPECIALISTS` to test routing logic.
   - `packages/orchestrator/src/orchestrator.test.ts` integration tests rely on the full orchestrator pipeline.
   - `apps/api/src/server.test.ts` relies on the fact that agents are magically available.

10. **Circular dependencies or unnecessary coupling:**
   - `orchestrator.ts` -> `agents.ts` -> `orchestrator/planner.ts`.
   - The Orchestrator domain knows about the internal system prompts, temperature, and specific focuses (like "react", "dotnet") of concrete reviewers.

## Target Architecture

### Proposed Dependency Flow
1. **Boot (`apps/api/src/server.ts`):** Imports the concrete `SPECIALISTS` definitions, builds the `RegisteredAgent` objects, and registers them into the `MapAgentRegistry`.
2. **Orchestrator (`ReviewOrchestrator`):** Receives the fully populated `AgentRegistry` in its context. It queries `registry.list()` to see what agents exist.
3. **Planner (`plan()`):** Receives `readonly AgentDefinition[]` instead of `readonly SpecialistSpec[]`. We will map the routing heuristics to use `AgentDefinition` metadata (e.g., using `id` like `agent.react-reviewer` or adding a generic `tags` array to `AgentDefinition`, or deriving focus from the definition).

### Interfaces / Contracts
- We will rely strictly on the `@ai-review/core` interfaces: `AgentDefinition`, `AgentHandler`, `AgentRegistry`.
- We may need a small modification to `AgentDefinition` (e.g., a `focus` or `tags` property) to support the Planner's deterministic routing without exposing internal types, OR the planner can deduce routing from `AgentId`. (Preferably adding an optional `focus?: string` or `metadata?: Record<string, unknown>` to `AgentDefinition`).

### Proposed Migration Sequence
1. **Extract Agents:** Move `agents.ts` out of `packages/orchestrator/src/` into a more appropriate place (e.g., `packages/agents/` or `apps/api/src/agents/`).
2. **Update Registry Bootstrapping:** In `apps/api/src/server.ts`, populate the `MapAgentRegistry` with the extracted agents *before* passing it to the Orchestrator.
3. **Decouple Planner:** Update `packages/orchestrator/src/planner.ts` to accept `AgentDefinition[]` instead of `SpecialistSpec[]`. Adjust the heuristics to key off `agent.id` or a new metadata field.
4. **Clean Orchestrator:** Remove all agent-building logic, `SPECIALISTS` imports, and `registry.register()` calls from `packages/orchestrator/src/orchestrator.ts`. The orchestrator will purely read from `registry.list()`.
5. **Fix Tests:** Update `planner.test.ts` and `orchestrator.test.ts` to inject mock or real agents into the registry during setup.

### Risks & Mitigation
- **Risk:** The deterministic planner might drop reviews if it can't map an agent to a file correctly after losing `SpecialistSpec.focus`.
- **Mitigation:** Ensure `focus` is preserved, either through `AgentDefinition.id` parsing or by standardizing a metadata field in `AgentDefinition`.

## Recommended First Step

**Step 1:** Add an optional `focus?: string` field (or `tags?: string[]`) to the `AgentDefinition` interface in `@ai-review/core`. This gives the Planner a generic way to filter agents without relying on the custom `SpecialistSpec` type, avoiding complex reflection or ID parsing.

*(Do not implement yet, waiting for approval on this plan).*
