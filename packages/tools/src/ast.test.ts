/**
 * AST tool tests (Phase 4).
 *
 * Exercises the structural extractor and the tool wrapper against a
 * temporary workspace file.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { AstSymbolsTool, extractSymbols } from "./ast.js";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-review-ast-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("extractSymbols", () => {
  it("extracts imports, exports, and classified symbols", () => {
    const text = [
      "import { useRef } from 'react';",
      "export function useCounter() { return useRef(0); }",
      "export const Button = () => <button />;",
      "const hidden = 1;",
      "export interface Props {}",
    ].join("\n");
    const { imports, exports, symbols } = extractSymbols("widget.tsx", text);
    expect(imports).toEqual(["react"]);
    expect(exports).toContain("useCounter");
    expect(exports).toContain("Button");
    expect(exports).toContain("Props");
    const kinds = new Map(symbols.map((s) => [s.name, s.kind]));
    expect(kinds.get("useCounter")).toBe("hook");
    expect(kinds.get("Button")).toBe("component");
    expect(kinds.get("hidden")).toBe("variable");
    expect(kinds.get("Props")).toBe("type");
  });

  it("marks symbols spanning changed lines", () => {
    const text =
      "export function changed() { return 1; }\nexport function untouched() { return 2; }\n";
    const { symbols } = extractSymbols("a.ts", text, new Set([1]));
    const byName = new Map(symbols.map((s) => [s.name, s.changed]));
    expect(byName.get("changed")).toBe(true);
    expect(byName.get("untouched")).toBe(false);
  });
});

describe("AstSymbolsTool", () => {
  it("parses a workspace file and returns its structure", async () => {
    await fs.writeFile(
      path.join(root, "app.ts"),
      "import { hi } from './hello.js';\nexport function run(): number { return hi; }\n",
    );
    const tool = new AstSymbolsTool(root);
    const res = await tool.invoke({
      toolId: tool.descriptor.id,
      input: { path: "app.ts" },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.output.imports).toEqual(["./hello.js"]);
      expect(res.value.output.exports).toContain("run");
      expect(res.value.output.symbols.length).toBeGreaterThan(0);
    }
  });

  it("flags changed symbols when changedLines is provided", async () => {
    await fs.writeFile(
      path.join(root, "app.ts"),
      "export function run(): number { return 1; }\n",
    );
    const tool = new AstSymbolsTool(root);
    const res = await tool.invoke({
      toolId: tool.descriptor.id,
      input: { path: "app.ts", changedLines: [1] },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const run = (
        res.value.output.symbols as { name: string; changed: boolean }[]
      ).find((s) => s.name === "run");
      expect(run?.changed).toBe(true);
    }
  });

  it("refuses traversal like the other tools", async () => {
    const tool = new AstSymbolsTool(root);
    const res = await tool.invoke({
      toolId: tool.descriptor.id,
      input: { path: "../secret.ts" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("tool.fs.outside_workspace");
  });

  it("returns not_found for a missing file", async () => {
    const tool = new AstSymbolsTool(root);
    const res = await tool.invoke({
      toolId: tool.descriptor.id,
      input: { path: "missing.ts" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.category).toBe("not_found");
  });
});
