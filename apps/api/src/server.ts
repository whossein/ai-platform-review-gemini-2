/**
 * @ai-review/api — HTTP review server.
 *
 * A thin, dependency-free HTTP surface over the shared `@ai-review/orchestrator`
 * so the Web and Desktop UIs (and any external caller) can run the exact same
 * pipeline the CLI runs. Built on Node's `http` module to keep the platform
 * free of a web-framework dependency at this stage.
 *
 * Endpoints:
 *   GET  /health           → { status: 'ok' }
 *   POST /estimate         → estimate review cost
 *   POST /review           → run a review over a diff
 *
 * CORS is permissive by default so the local Web UI (a different origin/port)
 * can call it during development; lock this down behind a gateway in production.
 */

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  SPECIALISTS,
  makeSpecialistDefinition,
  makeSpecialistHandler,
} from "@ai-review/shared";
import {
  MapAgentRegistry,
} from "@ai-review/agent-runtime";
import {
  estimateHandler,
  reviewHandler,
} from "./handlers/index.js";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
    ...CORS_HEADERS,
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Build and populate the agent registry (composition root).
 */
function createAgentRegistry(env: Record<string, string> = {}): MapAgentRegistry {
  const registry = new MapAgentRegistry();
  for (const spec of SPECIALISTS) {
    registry.register({
      definition: makeSpecialistDefinition(spec, env),
      handler: makeSpecialistHandler(spec, env),
    });
  }
  return registry;
}

async function handleEstimateRoute(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const body = JSON.parse((await readBody(req)) || "{}");
    const registry = createAgentRegistry(body.env ?? {});
    const result = await estimateHandler(
      { diff: body.diff, env: body.env },
      registry
    );
    send(res, 200, result);
  } catch (err: any) {
    const msg = err.message || "internal error";
    const isClientError = msg.includes("required") || msg.includes("invalid");
    send(res, isClientError ? 400 : 500, { error: msg });
  }
}

async function handleReviewRoute(
  req: IncomingMessage,
  res: ServerResponse,
  extraProviders?: any[]
): Promise<void> {
  try {
    const body = JSON.parse((await readBody(req)) || "{}");
    const registry = createAgentRegistry(body.env ?? {});
    const result = await reviewHandler(
      { diff: body.diff, threshold: body.threshold, env: body.env },
      registry,
      extraProviders
    );
    send(res, 200, result);
  } catch (err: any) {
    const msg = err.message || "internal error";
    const isClientError = msg.includes("required") || msg.includes("invalid");
    send(res, isClientError ? 400 : 500, { error: msg });
  }
}

export function createReviewServer(deps?: { extraProviders?: any[] }): ReturnType<typeof createServer> {
  return createServer((req, res) => {
    void (async () => {
      if (req.method === "OPTIONS") {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
      }
      if (req.method === "GET" && req.url === "/health") {
        send(res, 200, { status: "ok" });
        return;
      }
      if (req.method === "POST" && req.url === "/estimate") {
        await handleEstimateRoute(req, res);
        return;
      }
      if (req.method === "POST" && req.url === "/review") {
        await handleReviewRoute(req, res, deps?.extraProviders);
        return;
      }
      send(res, 404, { error: "not found" });
    })().catch((err: unknown) => {
      send(res, 500, {
        error: err instanceof Error ? err.message : "internal error",
      });
    });
  });
}
