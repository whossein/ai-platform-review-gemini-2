import type { LLMProvider, Budget, BudgetGuard } from "@ai-review/core";
import { DefaultContextEngine } from "@ai-review/context-engine";
import {
  providersFromEnv,
  CheapestFirstRouter,
  RoutingLLMClient,
  CachingLLMClient,
} from "@ai-review/llm";
import {
  MapAgentRegistry,
  DefaultAgentRuntime,
} from "@ai-review/agent-runtime";
import {
  SPECIALISTS,
  makeSpecialistDefinition,
  makeSpecialistHandler,
  InMemoryCache,
} from "@ai-review/shared";
import { InMemoryMemoryStore } from "@ai-review/memory";
import { DagWorkflowEngine, type StageExecutor } from "@ai-review/workflow-engine";
import {
  ReviewOrchestrator,
  type OrchestratorContext,
  type RunOptions,
  type ReviewResult,
} from "./orchestrator.js";

const llmCache = new InMemoryCache<any>("llm_response");

/**
 * Canonical review pipeline factory and executor.
 *
 * Configures and runs the full multi-agent review pipeline:
 * Context Engine → Dynamic Agent Registry → Routing LLM Client (with cache) →
 * DAG Workflow Engine → Review Orchestrator.
 */
export async function runReview(
  opts: RunOptions,
  extraProviders?: readonly LLMProvider[]
): Promise<ReviewResult> {
  const contextEngine = new DefaultContextEngine();
  const envProviders = [
    ...(extraProviders ?? []),
    ...providersFromEnv(opts.env ?? {}),
  ];
  const router = new CheapestFirstRouter(envProviders);
  const routingCtx = {
    requiredCapabilities: [],
    budget: opts.budget ?? {
      tokenBudget: 1000000,
      dollarBudget: 100,
      executionBudgetMs: 100000,
    },
  };
  const llm = new CachingLLMClient(
    new RoutingLLMClient(envProviders, router, routingCtx),
    llmCache,
  );
  const memoryStore = new InMemoryMemoryStore();
  const registry = new MapAgentRegistry();

  for (const spec of SPECIALISTS) {
    registry.register({
      definition: makeSpecialistDefinition(spec, opts.env),
      handler: makeSpecialistHandler(spec, opts.env),
    });
  }

  const runtime = new DefaultAgentRuntime(registry);
  const pricing = new Map();

  const ctx: OrchestratorContext = {
    contextEngine,
    llm,
    memoryStore,
    registry,
    runtime,
    pricing,
    createWorkflowEngine: (
      executor: StageExecutor,
      makeBudgetGuard: (b: Budget) => BudgetGuard,
    ) => new DagWorkflowEngine(executor, makeBudgetGuard as any),
  };
  const orchestrator = new ReviewOrchestrator(ctx);
  return orchestrator.review(opts);
}
