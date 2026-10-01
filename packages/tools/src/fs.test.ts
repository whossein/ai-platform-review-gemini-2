/**
 * Filesystem tool tests (Phase 4).
 *
 * Each tool is exercised independently against a temporary workspace —
 * no registry, no runtime, no LLM. Proves: happy path, path-traversal
 * refusal, bounded reads, and error normalization.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  ListFilesTool,
  ReadFileTool,
  SearchFilesTool,
  resolveInside,
} from "./fs.js";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-review-tools-"));
  await fs.writeFile(path.join(root, "hello.ts"), "export const hi = 1;\n");
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(
    path.join(root, "src", "app.ts"),
    "import { hi } from '../hello.js';\nexport function run(): number { return hi; }\n",
  );
  await fs.mkdir(path.join(root, "node_modules", "dep"), { recursive: true });
  await fs.writeFile(path.join(root, "node_modules", "dep", "x.ts"), "skip me");
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("resolveInside", () => {
  it("resolves a relative path inside the root", () => {
    const res = resolveInside(root, "hello.ts");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe(path.resolve(root, "hello.ts"));
  });

  it("refuses traversal outside the root", () => {
    for (const evil of ["../etc/passwd", "../../secret", ".."]) {
      const res = resolveInside(root, evil);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("tool.fs.outside_workspace");
    }
  });

  it("refuses empty/non-string paths", () => {
    expect(resolveInside(root, "").ok).toBe(false);
    expect(resolveInside(root, undefined as unknown as string).ok).toBe(false);
  });
});

describe("ReadFileTool", () => {
  it("reads a file inside the workspace", async () => {
    const tool = new ReadFileTool(root);
    const res = await tool.invoke({
      toolId: tool.descriptor.id,
      input: { path: "hello.ts" },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const output = res.value.output as any;
      expect(output.content).toBe("export const hi = 1;\n");
      expect(output.truncated).toBe(false);
    }
  });

  it("truncates when the file exceeds maxBytes", async () => {
    const tool = new ReadFileTool(root);
    const res = await tool.invoke({
      toolId: tool.descriptor.id,
      input: { path: "hello.ts", maxBytes: 5 },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const output = res.value.output as any;
      expect(output.truncated).toBe(true);
      expect(output.bytes).toBe(5);
    }
  });

  it("returns not_found for a missing file instead of throwing", async () => {
    const tool = new ReadFileTool(root);
    const res = await tool.invoke({
      toolId: tool.descriptor.id,
      input: { path: "nope.ts" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.category).toBe("not_found");
  });

  it("refuses a path outside the workspace", async () => {
    const tool = new ReadFileTool(root);
    const res = await tool.invoke({
      toolId: tool.descriptor.id,
      input: { path: "../outside.ts" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("tool.fs.outside_workspace");
  });
});

describe("ListFilesTool", () => {
  it("lists files recursively, skipping noise directories", async () => {
    const tool = new ListFilesTool(root);
    const res = await tool.invoke({ toolId: tool.descriptor.id, input: {} });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const output = res.value.output as any;
      expect(output.files).toEqual(["hello.ts", "src/app.ts"]);
      expect(output.truncated).toBe(false);
    }
  });

  it("can be scoped to a subdirectory", async () => {
    const tool = new ListFilesTool(root);
    const res = await tool.invoke({
      toolId: tool.descriptor.id,
      input: { path: "src" },
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.value.output as any).files).toEqual(["src/app.ts"]);
  });

  it("respects the maxEntries cap and flags truncation", async () => {
    const tool = new ListFilesTool(root);
    const res = await tool.invoke({
      toolId: tool.descriptor.id,
      input: { maxEntries: 1 },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const output = res.value.output as any;
      expect(output.files.length).toBe(1);
      expect(output.truncated).toBe(true);
    }
  });
});

describe("SearchFilesTool", () => {
  it("finds matches with path and line numbers", async () => {
    const tool = new SearchFilesTool(root);
    const res = await tool.invoke({
      toolId: tool.descriptor.id,
      input: { pattern: "export const" },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const output = res.value.output as any;
      expect(output.matches).toEqual([
        { path: "hello.ts", line: 1, text: "export const hi = 1;" },
      ]);
    }
  });

  it("rejects an invalid regex with a validation error", async () => {
    const tool = new SearchFilesTool(root);
    const res = await tool.invoke({
      toolId: tool.descriptor.id,
      input: { pattern: "([unclosed" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("tool.fs.invalid_regex");
  });

  it("rejects an empty pattern", async () => {
    const tool = new SearchFilesTool(root);
    const res = await tool.invoke({
      toolId: tool.descriptor.id,
      input: { pattern: "" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("tool.fs.invalid_pattern");
  });
});
