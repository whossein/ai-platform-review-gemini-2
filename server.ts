import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  SPECIALISTS,
  makeSpecialistDefinition,
  makeSpecialistHandler,
  loadDotEnv,
} from "@ai-review/shared";
import { MapAgentRegistry } from "@ai-review/agent-runtime";
import { PersistentMemoryStore } from "@ai-review/memory";
import {
  estimateHandler,
  reviewHandler,
  publishHandler,
  applyLocalHandler,
  modelsHandler,
  testProviderHandler,
  listProjectsHandler,
  getProjectDetailsHandler,
  createProjectHandler,
  findOrCreateProjectHandler,
  recordReviewHandler,
  deleteProjectHandler,
} from "./apps/api/src/handlers/index.js";
import { ProjectStore } from "./apps/api/src/project-store.js";

loadDotEnv();

// Map AI Studio's default Gemini API key to this project's expected variables
if (process.env.GEMINI_API_KEY) {
  if (!process.env.AI_REVIEW_LLM_API_KEY) {
    process.env.AI_REVIEW_LLM_API_KEY = process.env.GEMINI_API_KEY;
  }
  if (!process.env.AI_REVIEW_LLM_PROVIDER) {
    process.env.AI_REVIEW_LLM_PROVIDER = "gemini";
  }
}

if (process.env.AVALAI_API_KEY && !process.env.AI_REVIEW_AVALAI_API_KEY) {
  process.env.AI_REVIEW_AVALAI_API_KEY = process.env.AVALAI_API_KEY;
}

async function startServer() {
  const app = express();
  const portArgIndex = process.argv.indexOf("--port");
  const cliPort = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : undefined;
  const PORT = cliPort || 3000;

  // Build and populate the agent registry at startup (composition root)
  const agentRegistry = new MapAgentRegistry();
  for (const spec of SPECIALISTS) {
    agentRegistry.register({
      definition: makeSpecialistDefinition(spec, process.env as Record<string, string>),
      handler: makeSpecialistHandler(spec, process.env as Record<string, string>),
    });
  }

  // Phase 5: Persistent memory store injected at composition root
  const memoryStore = new PersistentMemoryStore("./.data/memory");
  const projectStore = new ProjectStore("./.data");

  app.use(express.json({ limit: "50mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Project Registry Endpoints
  app.get("/api/projects", async (_req, res) => {
    try {
      const result = await listProjectsHandler(projectStore);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to list projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const result = await getProjectDetailsHandler(projectStore, req.params.id);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const result = await createProjectHandler(projectStore, req.body || {});
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: err.message || "Failed to create project",
        code: err.code,
        existingProject: err.existingProject,
      });
    }
  });

  app.post("/api/projects/find-or-create", async (req, res) => {
    try {
      const result = await findOrCreateProjectHandler(projectStore, req.body || {});
      res.status(200).json(result);
    } catch (err: any) {
      res.status(err.status || 400).json({ error: err.message || "Failed to resolve project" });
    }
  });

  app.post("/api/projects/:id/reviews", async (req, res) => {
    try {
      const result = await recordReviewHandler(projectStore, req.params.id, req.body || {});
      res.status(200).json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to record review" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const result = await deleteProjectHandler(projectStore, req.params.id);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || "Failed to delete project" });
    }
  });

  app.post("/api/estimate", async (req, res) => {
    try {
      const result = await estimateHandler(
        {
          diff: req.body?.diff,
          env: req.body?.env || req.body?.envOverrides,
        },
        agentRegistry
      );
      res.status(200).json(result);
    } catch (err: any) {
      const msg = err.message || "internal error";
      const isClientError = msg.includes("required") || msg.includes("invalid");
      res.status(isClientError ? 400 : 500).json({ error: msg });
    }
  });

  app.post("/api/review", async (req, res) => {
    try {
      const result = await reviewHandler(
        {
          diff: req.body?.diff,
          threshold: req.body?.threshold,
          env: req.body?.env || req.body?.envOverrides,
          selectedSpecialists: req.body?.selectedSpecialists,
        },
        agentRegistry,
        undefined,
        memoryStore
      );

      // Auto-associate review with project if diff is a URL or if projectId is supplied
      let associatedProject: any = undefined;
      let associatedMr: any = undefined;
      try {
        const diffStr = (req.body?.diff || "").trim();
        if (diffStr.startsWith("http://") || diffStr.startsWith("https://")) {
          const auto = await projectStore.findOrCreateFromUrl(diffStr);
          associatedProject = auto.project;
          associatedMr = auto.mergeRequest;
          await projectStore.recordReview({
            projectId: auto.project.id,
            mergeRequestId: auto.mergeRequest?.id,
            model: req.body?.env?.AI_REVIEW_LLM_MODEL || req.body?.env?.AI_REVIEW_LLM_PROVIDER,
            target: diffStr,
            inputMode: "pr",
            result,
          });
        } else if (req.body?.projectId) {
          await projectStore.recordReview({
            projectId: req.body.projectId,
            mergeRequestId: req.body.mergeRequestId,
            model: req.body?.env?.AI_REVIEW_LLM_MODEL || req.body?.env?.AI_REVIEW_LLM_PROVIDER,
            target: req.body.target || "Diff snippet",
            inputMode: req.body.inputMode || "diff",
            result,
          });
        }
      } catch (projErr) {
        console.warn("Project association error:", projErr);
      }

      res.status(200).json({
        ...result,
        ...(associatedProject ? { project: associatedProject } : {}),
        ...(associatedMr ? { mergeRequest: associatedMr } : {}),
      });
    } catch (err: any) {
      const msg = err.message || "internal error";
      const isClientError = msg.includes("required") || msg.includes("invalid");
      res.status(isClientError ? 400 : 500).json({ error: msg });
    }
  });

  app.post("/api/test-provider", async (req, res) => {
    try {
      const result = await testProviderHandler(req.body || {});
      res.status(200).json(result);
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        error: err.message || "Internal error",
        latencyMs: err.latencyMs,
      });
    }
  });

  app.post("/api/models", async (req, res) => {
    try {
      const result = await modelsHandler(req.body || {});
      res.status(200).json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message || "Internal error" });
    }
  });

  app.post("/api/publish", async (req, res) => {
    try {
      const result = await publishHandler(req.body || {});
      res.status(200).json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Internal error" });
    }
  });

  app.post("/api/apply-local", async (req, res) => {
    try {
      const result = await applyLocalHandler(req.body || {});
      res.status(200).json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "internal error" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    // We must point vite to the apps/web directory
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: path.resolve(process.cwd(), "apps/web"),
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "apps/web/dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Keep connections alive during deep AI multi-agent reviews (10 mins)
  server.timeout = 600_000;
  server.keepAliveTimeout = 120_000;
  server.headersTimeout = 610_000;
}

startServer().catch(console.error);
