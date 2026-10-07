/**
 * Typed client for the @ai-review/api server. The Web and Desktop UIs share this
 * module so both speak to the exact same review pipeline. All calls go through
 * the `/api` prefix, which Vite proxies to the API server in dev (see
 * vite.config.ts) and which a reverse proxy handles in production.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface ReviewIssue {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: Severity;
  readonly confidence: number;
  readonly reason: string;
  readonly suggestion?: {
    readonly description: string;
    readonly patch?: string;
  };
  readonly location: { readonly file: string; readonly line?: number };
  readonly category: string;
  readonly accepted: boolean;
  readonly rankScore: number;
}

export interface ReviewResponse {
  readonly markdown: string;
  readonly json: unknown;
  readonly accepted: number;
  readonly total: number;
  readonly issues: readonly ReviewIssue[];
  readonly metrics?: {
    readonly totalPromptTokens: number;
    readonly totalCompletionTokens: number;
    readonly totalCostUsd: number;
  };
  readonly project?: Project | undefined;
  readonly mergeRequest?: ProjectMergeRequest | undefined;
}

export interface EstimateResponse {
  readonly agents: readonly string[];
  readonly skipped: readonly string[];
  readonly totalAgents: number;
  readonly estimatedTokens: number;
  readonly estimatedInputTokens?: number;
  readonly estimatedOutputTokens?: number;
  readonly inputCostPer1M?: number;
  readonly outputCostPer1M?: number;
  readonly estimatedCostUsd: number;
  readonly deterministicIssues?: readonly ReviewIssue[];
}

export async function requestEstimate(
  diff: string,
  env?: Record<string, string>,
): Promise<EstimateResponse> {
  const res = await fetch("/api/estimate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ diff, ...(env ? { env } : {}) }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `estimate failed (${res.status})`);
  }
  return (await res.json()) as EstimateResponse;
}

export async function requestReview(
  diff: string,
  threshold?: number,
  env?: Record<string, string>,
  selectedSpecialists?: readonly string[],
  signal?: AbortSignal,
  projectId?: string,
  mergeRequestId?: string,
): Promise<ReviewResponse> {
  const reqInit: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      diff,
      ...(threshold !== undefined ? { threshold } : {}),
      ...(env ? { env } : {}),
      ...(selectedSpecialists ? { selectedSpecialists } : {}),
      ...(projectId ? { projectId } : {}),
      ...(mergeRequestId ? { mergeRequestId } : {}),
    }),
  };
  if (signal) {
    reqInit.signal = signal;
  }

  const res = await fetch("/api/review", reqInit);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `review failed (${res.status})`);
  }
  return (await res.json()) as ReviewResponse;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/health");
    return res.ok;
  } catch {
    return false;
  }
}

export async function requestPublish(
  diff: string,
  issues: readonly ReviewIssue[],
  env?: Record<string, string>,
): Promise<unknown> {
  const res = await fetch("/api/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ diff, issues, ...(env ? { env } : {}) }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `publish failed (${res.status})`);
  }
  return await res.json();
}

export async function requestApplyLocal(
  localPath: string,
  issues: readonly ReviewIssue[],
): Promise<unknown> {
  const res = await fetch("/api/apply-local", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ localPath, issues }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `apply failed (${res.status})`);
  }
  return await res.json();
}

export interface TestProviderResult {
  readonly ok: boolean;
  readonly message?: string;
  readonly error?: string;
  readonly latencyMs?: number;
  readonly model?: string;
}

export async function requestTestProvider(config: {
  provider: string;
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  model?: string | undefined;
  customAuthHeaderName?: string | undefined;
  customAuthHeaderPrefix?: string | undefined;
}): Promise<TestProviderResult> {
  const res = await fetch("/api/test-provider", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config),
  });
  const data = (await res
    .json()
    .catch(() => ({
      ok: false,
      error: `HTTP ${res.status}`,
    }))) as TestProviderResult;
  return data;
}

// ----------------------------------------------------
// Project Registry & Management API Client
// ----------------------------------------------------

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly repositoryUrl: string;
  readonly gitHost: string;
  readonly repositoryPath: string;
  readonly namespace: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectMergeRequest {
  readonly id: string;
  readonly projectId: string;
  readonly mrNumber: string;
  readonly url: string;
  readonly title?: string | undefined;
  readonly sourceBranch?: string | undefined;
  readonly targetBranch?: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectReviewRecord {
  readonly id: string;
  readonly projectId: string;
  readonly mergeRequestId?: string | undefined;
  readonly timestamp: number;
  readonly inputMode: string;
  readonly target: string;
  readonly model: string;
  readonly score?: number | undefined;
  readonly issuesCount: number;
  readonly acceptedCount: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly summaryMarkdown?: string | undefined;
}

export interface ProjectWithStats extends Project {
  readonly mergeRequestCount: number;
  readonly reviewCount: number;
  readonly latestReview?: ProjectReviewRecord | undefined;
  readonly averageScore?: number | undefined;
}

export interface ProjectDetailsResponse {
  readonly project: Project;
  readonly mergeRequests: ProjectMergeRequest[];
  readonly reviews: ProjectReviewRecord[];
  readonly stats: {
    readonly mergeRequestCount: number;
    readonly reviewCount: number;
    readonly averageScore?: number | undefined;
    readonly latestReview?: ProjectReviewRecord | undefined;
  };
}

export async function fetchProjects(): Promise<ProjectWithStats[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) {
    throw new Error(`Failed to fetch projects (${res.status})`);
  }
  const data = await res.json();
  return data.projects || [];
}

export async function fetchProjectDetails(
  id: string,
): Promise<ProjectDetailsResponse> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Project not found (${res.status})`);
  }
  return await res.json();
}

export async function createProject(params: {
  name?: string | undefined;
  repositoryUrl: string;
}): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Failed to create project (${res.status})`);
    (err as any).code = data.code;
    (err as any).existingProject = data.existingProject;
    throw err;
  }
  return data.project;
}

export async function findOrCreateProjectFromUrl(
  url: string,
  name?: string,
): Promise<{
  project: Project;
  mergeRequest?: ProjectMergeRequest;
  created: boolean;
}> {
  const res = await fetch("/api/projects/find-or-create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url, ...(name ? { name } : {}) }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to resolve project from URL (${res.status})`);
  }
  return await res.json();
}

export async function deleteProject(id: string): Promise<boolean> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to delete project (${res.status})`);
  }
  return true;
}

