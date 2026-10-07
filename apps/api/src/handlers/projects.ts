/**
 * Project Handlers
 *
 * REST endpoint handlers for the Project Registry & Management system.
 */

import type { ProjectStore } from "../project-store.js";

export async function listProjectsHandler(projectStore: ProjectStore) {
  const projects = await projectStore.listProjects();
  return { projects };
}

export async function getProjectDetailsHandler(
  projectStore: ProjectStore,
  id: string,
) {
  const details = await projectStore.getProject(id);
  if (!details) {
    const error = new Error(`Project with ID "${id}" not found`);
    (error as any).status = 404;
    throw error;
  }
  return details;
}

export async function createProjectHandler(
  projectStore: ProjectStore,
  body: { name?: string | undefined; repositoryUrl?: string | undefined },
) {
  if (!body.repositoryUrl || typeof body.repositoryUrl !== "string") {
    const error = new Error("Field 'repositoryUrl' is required");
    (error as any).status = 400;
    throw error;
  }

  try {
    const project = await projectStore.createProject({
      name: body.name || undefined,
      repositoryUrl: body.repositoryUrl,
    });
    return { project };
  } catch (err: any) {
    if (err.code === "DUPLICATE_PROJECT") {
      err.status = 409; // Conflict
    } else if (err.message.includes("Invalid")) {
      err.status = 400;
    }
    throw err;
  }
}

export async function findOrCreateProjectHandler(
  projectStore: ProjectStore,
  body: { url?: string | undefined; name?: string | undefined },
) {
  if (!body.url || typeof body.url !== "string") {
    const error = new Error("Field 'url' is required");
    (error as any).status = 400;
    throw error;
  }

  const result = await projectStore.findOrCreateFromUrl(body.url, body.name || undefined);
  return result;
}

export async function recordReviewHandler(
  projectStore: ProjectStore,
  projectId: string,
  body: {
    mergeRequestId?: string | undefined;
    reviewId?: string | undefined;
    model?: string | undefined;
    target?: string | undefined;
    inputMode?: string | undefined;
    result?: any;
    score?: number | undefined;
  },
) {
  const record = await projectStore.recordReview({
    projectId,
    mergeRequestId: body.mergeRequestId || undefined,
    reviewId: body.reviewId || undefined,
    model: body.model || undefined,
    target: body.target || "",
    inputMode: body.inputMode || undefined,
    result: body.result,
    score: body.score !== undefined ? body.score : undefined,
  });
  return { record };
}

export async function deleteProjectHandler(
  projectStore: ProjectStore,
  id: string,
) {
  const success = await projectStore.deleteProject(id);
  if (!success) {
    const error = new Error(`Project with ID "${id}" not found`);
    (error as any).status = 404;
    throw error;
  }
  return { success: true };
}
