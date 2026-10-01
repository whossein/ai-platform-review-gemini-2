import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  MapToolRegistry,
  createDefaultToolRegistry,
  createToolAccessor,
} from "./registry.js";
import type { ToolId } from "@ai-review/core";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-review-tool-reg-"));
  await fs.writeFile(path.join(root, "file.ts"), "export const a = 1;\n");
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("MapToolRegistry and createToolAccessor", () => {
  it("registers standard tools and lists descriptors", () => {
    const registry = createDefaultToolRegistry(root);
    const descriptors = registry.list();
    expect(descriptors.length).toBe(4);
    const ids = descriptors.map((d) => d.id);
    expect(ids).toContain("tool.fs.read");
    expect(ids).toContain("tool.fs.list");
    expect(ids).toContain("tool.fs.search");
    expect(ids).toContain("tool.ast.symbols");
  });

  it("invokes tools via accessor successfully", async () => {
    const registry = createDefaultToolRegistry(root);
    const accessor = createToolAccessor(registry);
    expect(accessor.available().length).toBe(4);

    const res = await accessor.invoke({
      toolId: "tool.fs.read" as ToolId,
      input: { path: "file.ts" },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect((res.value.output as any).content).toBe("export const a = 1;\n");
    }
  });

  it("returns not_found error when invoking an unregistered tool", async () => {
    const registry = new MapToolRegistry();
    const accessor = createToolAccessor(registry);
    const res = await accessor.invoke({
      toolId: "tool.unknown" as ToolId,
      input: {},
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.category).toBe("not_found");
      expect(res.error.code).toBe("tool.not_found");
    }
  });
});
