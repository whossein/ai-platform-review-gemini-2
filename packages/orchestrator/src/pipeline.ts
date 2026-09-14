import type { LLMProvider, Budget, BudgetGuard, AgentRegistry } from "@ai-review/core";
import { DefaultContextEngine } from "@ai-review/context-engine";
import {
  providersFromEnv,
  CheapestFirstRouter,
  RoutingLLMClient,
  CachingLLMClient,
} from "@ai-review/llm";
import { DefaultAgentRuntime } from "@ai-review/agent-runtime";
import { InMemoryCache } from "@ai-review/shared";
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
 * Context Engine → Agent Registry (pre-populated) → Routing LLM Client (with cache) →
 * DAG Workflow Engine → Review Orchestrator.
 *
 * @param registry - Pre-populated agent registry (agents must be registered by the caller)
 * @param opts - Review execution options
 * @param extraProviders - Optional additional LLM providers to merge with env-based providers
 */
export async function runReview(
  registry: AgentRegistry,
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
