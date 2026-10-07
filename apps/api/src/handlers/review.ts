/**
 * Review handler — Execute multi-agent code review pipeline.
 *
 * Accepts a diff string and optional threshold, executes the full review pipeline,
 * automatically detects or links projects, updates persistent project statistics,
 * and returns markdown/JSON reports with issue details and metrics.
 *
 * This handler encapsulates the review logic shared between:
 *  - Root Express server (server.ts)
 *  - Standalone API server (apps/api/src/server.ts)
 */

import { runReview } from "@ai-review/orchestrator";
import { resolveDiffInput, parseDiffToFiles } from "@ai-review/git";
import type {
  AgentRegistry,
  LLMProvider,
  MemoryStore,
  Project,
} from "@ai-review/core";

export interface ReviewRequest {
  readonly diff: string;
  readonly threshold?: number;
  readonly env?: Record<string, string>;
  readonly selectedSpecialists?: readonly string[];
  readonly memoryStore?: MemoryStore;
  readonly projectId?: string;
  readonly projectName?: string;
}

export interface ReviewResponse {
  markdown: string;
  json: any;
  accepted: number;
  total: number;
  issues: readonly any[];
  metrics: {
    cacheHits: number;
    cacheMisses: number;
  };
  project?: Project;
}

export async function reviewHandler(
  request: ReviewRequest,
  agentRegistry: AgentRegistry,
  extraProviders?: readonly LLMProvider[],
  memoryStore?: MemoryStore,
): Promise<ReviewResponse> {
  const { diff, threshold, env = {}, selectedSpecialists } = request;
  const effectiveMemoryStore = memoryStore || request.memoryStore;

  if (!diff || typeof diff !== "string" || diff.trim().length === 0) {
    throw new Error('field "diff" is required');
  }

  const mergedEnv: Record<string, string> = { ...(process.env as Record<string, string>), ...env };
  const rawDiff = await resolveDiffInput(diff, mergedEnv);
  const parsedFiles = parseDiffToFiles(rawDiff);

  const result = await runReview(
    agentRegistry,
    {
      diff: rawDiff,
      files: parsedFiles,
      ...(threshold !== undefined ? { confidenceThreshold: threshold } : {}),
      env: mergedEnv,
      ...(Array.isArray(selectedSpecialists) ? { selectedSpecialists } : {}),
      ...(effectiveMemoryStore ? { memoryStore: effectiveMemoryStore } : {}),
    },
    extraProviders
  );

  return {
    markdown: result.markdown,
    json: JSON.parse(result.json),
    accepted: result.accepted,
    total: result.total,
    issues: result.issues,
    metrics: result.metrics,
  };
}
