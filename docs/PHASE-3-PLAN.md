# Phase 3 Plan: Server & Application Boundary Decoupling

## Overview & Objective

The objective of Phase 3 is to thin the application/server boundaries (`/server.ts` and `/apps/api/src/server.ts`) without introducing unnecessary abstractions, DI containers, or artificial indirection.

Currently, `/server.ts` (771 lines) and `/apps/api/src/server.ts` (296 lines) act as monolithic entry points combining HTTP server lifecycle, static asset/Vite middleware, remote git fetching, local filesystem manipulation, pricing/estimation heuristics, LLM connectivity testing, and review orchestration assembly.

---

## A. Current Server Responsibility Map

| Component | Responsibility in `server.ts` | Responsibility Classification | Target Destination |
| :--- | :--- | :--- | :--- |
| **Server Lifecycle & Hosting** | Port listening, keep-alive timeout configuration, error handling | Infrastructure / HTTP | Keep in `server.ts` / `apps/api/src/server.ts` |
| **Vite / Static Asset Middleware** | Dev Vite middleware mounting, production `dist` static file serving | Infrastructure / Web | Keep in `server.ts` |
| **Environment Variable Mapping** | Mapping `GEMINI_API_KEY` to standard platform env vars | Infrastructure / Config | `@ai-review/shared` (or shared env loader) |
| **Review Pipeline Composition (`runReview`)** | Instantiating ContextEngine, RoutingLLMClient, CachingLLMClient, AgentRegistry, Runtime, DagWorkflowEngine, Orchestrator | Application / Composition | Shared factory function `createReviewPipeline` |
| **Diff Resolution (`resolveDiffInput`)** | Parsing GitLab/GitHub URLs, fetching remote MR/PR diffs via REST, extracting metadata headers | Infrastructure / Git Integration | `@ai-review/git` or `@ai-review/repository` |
| **Diff Parsing (`parseDiffToFiles`)** | Parsing unified diff strings into per-file paths and content lines | Domain / Repository | `@ai-review/repository` (reuses `diff.ts`) |
| **Estimate Route (`/api/estimate`)** | Token estimation calculations, pricing lookups, deterministic rule execution, planner dry-run | Application Use Case | Extracted Route Handler / Application Helper |
| **Review Route (`/api/review`)** | Request parsing, input resolution, pipeline execution, JSON/Markdown response structuring | Application Use Case / HTTP | Extracted Route Handler |
| **Provider Testing & Models (`/api/test-provider`, `/api/models`)** | Pinging LLM endpoints with test prompts, querying `/v1/models` endpoints | Infrastructure / LLM Provider | `@ai-review/llm` / Extracted Route Handler |
| **Publish Route (`/api/publish`)** | Initializing GitLab provider and publishing comments via `ReviewPublisher` | Application Use Case / Git | Extracted Route Handler (using `@ai-review/git`) |
| **Local Apply Route (`/api/apply-local`)** | Reading local source files, inserting FIXME/TODO comments at line numbers, saving files | Infrastructure / Tools | `@ai-review/tools` or Extracted Handler |

---

## B. Dependency Graph

### Current Dependency Flow
```
[apps/web] ---> (HTTP) ---> [/server.ts] (Root Express + Vite)
                                 |
                                 +---> @ai-review/orchestrator
                                 +---> @ai-review/agent-runtime
                                 +---> @ai-review/context-engine
                                 +---> @ai-review/llm
                                 +---> @ai-review/memory
                                 +---> @ai-review/workflow-engine
                                 +---> @ai-review/git
                                 +---> @ai-review/shared
                                 +---> fs/promises (local file mutations)

[apps/web] ---> (HTTP) ---> [apps/api/src/server.ts] (Node http)
                                 |
                                 +---> Duplicated orchestration & estimation logic
```

### Proposed Target Dependency Flow
```
[apps/web] ---> (HTTP) ---> [/server.ts] (Root Express + Vite)
                                 | (Mounts shared Express/HTTP routes)
[Headless Client] --------> [apps/api] (Standalone HTTP server)
                                 |
                                 v
                     [API Route Handlers / Handlers Module]
                                 |
        +------------------------+------------------------+
        |                        |                        |
        v                        v                        v
[Review Pipeline Factory]   [Git Services]       [LLM Provider Services]
(@ai-review/orchestrator    (@ai-review/git)     (@ai-review/llm)
  or @ai-review/shared)
        |
        v
[@ai-review/core]
```

---

## C. Duplication Between Server Entry Points

1. **Pipeline Composition (`runReview`)**:
   - `/server.ts` (lines 28–69) and `/apps/api/src/server.ts` (lines 54–98) have identical copies of the multi-agent orchestration setup code.
2. **Estimation & Token Cost Heuristics**:
   - `/server.ts` (lines 240–326) and `/apps/api/src/server.ts` (lines 148–229) repeat identical token math (`Math.ceil(diff.length / 4) + 600`), preset pricing resolution, and JSON override parsing.
3. **HTTP Review Response Formatting**:
   - Both convert the `ReviewResult` object into `{ markdown, json, accepted, total, issues, metrics }`.

---

## D. Proposed Target Architecture

1. **Keep Entry Points Thin**:
   - `/server.ts`: Configures Express, mounts Vite dev middleware (in dev) or static file middleware (in prod), registers API route handlers, and starts listening.
   - `/apps/api/src/server.ts`: Configures Node `http` or Express app for headless API usage and registers the exact same route handlers.
2. **Shared Review Pipeline Factory**:
   - Provide a standard, reusable pipeline factory (`createReviewPipeline(options)` or `runReview(options)`) so all server and CLI entry points instantiate the review engine consistently.
3. **Co-located API Route Handlers**:
   - Encapsulate `/api/estimate`, `/api/review`, `/api/publish`, `/api/test-provider`, `/api/models`, and `/api/apply-local` into modular, typed handler functions.
4. **No DI Container or Heavy Service Class Hierarchy**:
   - Use straightforward TypeScript functions with explicit parameter passing and plain options objects.

---

## E. Exact Responsibilities of Proposed Components

1. **`createReviewPipeline` (Pipeline Factory)**:
   - *Responsibility*: Assembles standard `OrchestratorContext` dependencies (ContextEngine, Router, CachingClient, AgentRegistry, Runtime, DagWorkflowEngine) and executes reviews.
   - *Location*: `@ai-review/orchestrator` (or `@ai-review/shared`).
2. **API Route Handlers (`apps/api/src/routes/*.ts` or `server/routes.ts`)**:
   - *Responsibility*: Parse incoming HTTP request bodies, validate inputs, invoke the corresponding domain/application logic, and format HTTP responses with appropriate status codes and CORS headers.
3. **Diff & Change Request Resolver**:
   - *Responsibility*: Resolves raw diff strings or GitLab/GitHub URLs to unified diff content with metadata.
   - *Location*: `@ai-review/git` / `@ai-review/repository`.
4. **Local Patch Applicator**:
   - *Responsibility*: Applies accepted review issues as inline comments in local source files.
   - *Location*: `@ai-review/tools` or `@ai-review/repository`.

---

## F. Existing Components to Reuse

- `@ai-review/git`: `parseChangeRequestUrl`, `GitLabProvider`, `ReviewPublisher`, `baseUrlFromChangeRequestUrl`.
- `@ai-review/repository`: `parseUnifiedDiff` in `diff.ts`.
- `@ai-review/llm`: `resolveProviderPreset`, `resolveApiKey`, `OpenAICompatibleProvider`, `providersFromEnv`.
- `@ai-review/orchestrator`: `ReviewOrchestrator`, `plan`, `DefaultRuleEngine`, `MapRuleRegistry`, `DEFAULT_RULES`.
- `@ai-review/agent-runtime`: `MapAgentRegistry`, `DefaultAgentRuntime`.
- `@ai-review/shared`: `SPECIALISTS`, `makeSpecialistDefinition`, `makeSpecialistHandler`, `InMemoryCache`, `loadDotEnv`.

---

## G. Files That Would Change in Phase 3

- `/server.ts`: Thinned to ~120 lines focusing purely on server startup, Vite/static serving, and mounting route handlers.
- `/apps/api/src/server.ts`: Uses shared route handlers / pipeline factory.
- `/apps/api/src/routes.ts` (or modular route handler files in `apps/api`): Extracted route handlers.
- `/packages/git/src/resolvers.ts` or `packages/git/src/index.ts`: Standardized remote diff fetching if needed.

---

## H. Files That Should NOT Change in Phase 3

- `/packages/core/**` (Core types remain strictly unchanged).
- `/packages/agent-runtime/**` (Agent runtime abstractions remain unchanged).
- `/packages/workflow-engine/**` (DAG engine remains unchanged).
- `/packages/config/**` (Rule engine remains unchanged).
- `/packages/context-engine/**` (AST extraction remains unchanged).
- `/packages/reporting/**` (Renderers remain unchanged).
- `/apps/web/**` (Frontend remains unchanged).
- `/AGENTS.md` (Agent instructions remain unchanged).

---

## I. Migration Sequence in Small, Independently Verifiable Steps

1. **Step 1: Consolidate Review Pipeline Factory**
   - Extract the duplicated `runReview` pipeline assembly from `/server.ts` and `apps/api/src/server.ts` into a single shared helper (`createReviewPipeline` / `runReviewPipeline`) exported by `@ai-review/orchestrator` or `@ai-review/shared`.
   - Verify with `apps/api/src/server.test.ts` and `packages/orchestrator/src/orchestrator.test.ts`.

2. **Step 2: Extract Remote Diff & GitLab/GitHub Resolvers to `@ai-review/git`**
   - Move `resolveDiffInput` from `/server.ts` into `@ai-review/git`.
   - Add unit test in `packages/git/src/` to verify URL resolution and header generation.

3. **Step 3: Extract API Route Handlers into Modular Functions**
   - Extract `estimateHandler`, `reviewHandler`, `publishHandler`, `testProviderHandler`, `modelsHandler`, and `applyLocalHandler` into clean, testable handler modules in `apps/api/src/handlers/`.
   - Wire both `/server.ts` (Express) and `/apps/api/src/server.ts` (Node http / Express) to use these handlers.

4. **Step 4: Clean Up `/server.ts` and `/apps/api/src/server.ts`**
   - Remove redundant dead code and inline helpers from `/server.ts`.
   - Ensure both development mode (Vite HMR/middleware) and production mode (static file serving + SPA fallback) run flawlessly.

---

## J. Tests Required After Each Step

- **Unit Tests**: `npx turbo run test` (verifies all 29 package test suites).
- **API Tests**: `apps/api/src/server.test.ts` (verifies `/health`, `/review`, `/estimate`, 404 handling).
- **Typecheck**: `npm run lint` (`turbo run typecheck`).
- **Production Build**: `npm run build`.

---

## K. Risks & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| **Breaking Vite dev server in AI Studio preview** | Preserve the exact Express + Vite middleware initialization in `/server.ts`. |
| **Breaking long-running review timeouts** | Ensure 10-minute timeout headers (`req.setTimeout(600_000)`, `res.setTimeout(600_000)`, `keepAliveTimeout = 120_000`) remain configured in server lifecycle. |
| **Breaking standalone `@ai-review/api` tests** | Keep `createReviewServer` export with backwards-compatible interface in `apps/api/src/server.ts`. |
| **Regression in GitHub/GitLab URL fetching** | Maintain exact token resolution logic (`GITLAB_TOKEN`, `GITHUB_TOKEN`, `GIT_TOKEN`) and metadata headers. |

---

## L. Rollback Strategy

- Each step in the migration sequence is designed to be committed and tested independently.
- Because no database migrations or public protocol changes are involved, any step can be rolled back immediately via Git without state corruption.

---

## Recommended First Implementation Step

**Step 1: Consolidate the Review Pipeline Factory**
Extract the duplicated `runReview` function from `/server.ts` and `/apps/api/src/server.ts` into a single, clean factory/runner function in `@ai-review/orchestrator` (e.g. `runReview` or `createReviewPipeline`), and update `/server.ts`, `/apps/api/src/server.ts`, and test helpers to consume this single source of truth.
