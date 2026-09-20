/**
 * AST inspection tool (Phase 4, ADR-0009).
 *
 * A self-contained TypeScript/JavaScript structural extractor for
 * `@ai-review/tools`: imports, exports, and top-level symbols with kind,
 * location, and signature. It mirrors the extraction contract the Context
 * Engine uses (`SymbolInfo` from `@ai-review/core`) so agents get the same
 * shape on demand that the build-once slices serve (ADR-0004), without this
 * package depending on the context engine.
 */

import { promises as fs } from "node:fs";
import ts from "typescript";
import type {
  AsyncResult,
  SymbolInfo,
  Tool,
  ToolDescriptor,
  ToolId,
  ToolInvocation,
  ToolResult,
} from "@ai-review/core";
import { resolveInside, toolError } from "./fs.js";

const MAX_AST_FILE_BYTES = 2 * 1_048_576;

/** A React component: PascalCase or JSX-returning. A hook: `use*`. */
function classifyName(name: string, returnsJsx: boolean): SymbolInfo["kind"] {
  if (/^use[A-Z0-9]/.test(name)) return "hook";
  if (returnsJsx || /^[A-Z]/.test(name)) return "component";
  return "function";
}

/** Heuristic: does this node's subtree contain JSX? */
function containsJsx(node: ts.Node): boolean {
  let found = false;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (
      ts.isJsxElement(n) ||
      ts.isJsxSelfClosingElement(n) ||
      ts.isJsxFragment(n)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

/** Parses one source file's text into the structural facts agents need. */
export function extractSymbols(
  path: string,
  text: string,
  changedLines: ReadonlySet<number> = new Set(),
): { imports: string[]; exports: string[]; symbols: SymbolInfo[] } {
  const kind = /\.(tsx|jsx)$/.test(path)
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );

  const imports: string[] = [];
  const exports: string[] = [];
  const symbols: SymbolInfo[] = [];

  const lineOf = (pos: number): number =>
    sf.getLineAndCharacterOfPosition(pos).line + 1;

  const symbolSpansChange = (node: ts.Node): boolean => {
    const start = lineOf(node.getStart(sf));
    const end = lineOf(node.getEnd());
    for (let l = start; l <= end; l++) if (changedLines.has(l)) return true;
    return false;
  };

  const pushSymbol = (
    name: string,
    k: SymbolInfo["kind"],
    node: ts.Node,
    signature: string,
  ): void => {
    symbols.push({
      name,
      kind: k,
      location: { file: path, line: lineOf(node.getStart(sf)) },
      signature: signature.slice(0, 200),
      changed: changedLines.size === 0 ? false : symbolSpansChange(node),
    });
  };

  const isExported = (node: ts.Node): boolean =>
    ts.canHaveModifiers(node)
      ? (ts.getModifiers(node) ?? []).some(
          (m) => m.kind === ts.SyntaxKind.ExportKeyword,
        )
      : false;

  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }

    if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text);
      }
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) exports.push(el.name.text);
      }
    }

    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      const returnsJsx = node.body ? containsJsx(node.body) : false;
      const params = node.parameters.map((p) => p.getText(sf)).join(", ");
      pushSymbol(
        name,
        classifyName(name, returnsJsx),
        node,
        `function ${name}(${params})`,
      );
      if (isExported(node)) exports.push(name);
    }

    if (ts.isClassDeclaration(node) && node.name) {
      pushSymbol(node.name.text, "class", node, `class ${node.name.text}`);
      if (isExported(node)) exports.push(node.name.text);
    }

    if (ts.isTypeAliasDeclaration(node)) {
      pushSymbol(node.name.text, "type", node, `type ${node.name.text}`);
      if (isExported(node)) exports.push(node.name.text);
    }
    if (ts.isInterfaceDeclaration(node)) {
      pushSymbol(node.name.text, "type", node, `interface ${node.name.text}`);
      if (isExported(node)) exports.push(node.name.text);
    }

    if (ts.isVariableStatement(node)) {
      const exported = isExported(node);
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const name = decl.name.text;
        const init = decl.initializer;
        const isFn =
          init !== undefined &&
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init));
        const returnsJsx = isFn ? containsJsx(init) : false;
        pushSymbol(
          name,
          isFn ? classifyName(name, returnsJsx) : "variable",
          decl,
          name,
        );
        if (exported) exports.push(name);
      }
    }

    if (ts.isExportAssignment(node)) exports.push("default");

    ts.forEachChild(node, visit);
  };

  visit(sf);
  return {
    imports: [...new Set(imports)],
    exports: [...new Set(exports)],
    symbols,
  };
}

/**
 * Parses a TypeScript/JavaScript file and returns its structural facts:
 * imports, exports, and symbols (name/kind/location/signature/changed).
 */
export class AstSymbolsTool implements Tool {
  readonly descriptor: ToolDescriptor = {
    id: "tool.ast.symbols" as ToolId,
    name: "ast.symbols",
    description:
      "Parse a TypeScript/JavaScript file and return imports, exports, and symbols with signatures and locations.",
    origin: "internal",
    schema: {
      input: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative file path" },
          changedLines: {
            type: "array",
            items: { type: "number" },
            description:
              "Optional 1-based new-file line numbers to flag symbols changed",
          },
        },
        required: ["path"],
      },
      output: {
        type: "object",
        properties: {
          path: { type: "string" },
          imports: { type: "array", items: { type: "string" } },
          exports: { type: "array", items: { type: "string" } },
          symbols: { type: "array" },
        },
      },
    },
    capabilities: ["filesystem_read"],
  };

  constructor(private readonly root: string) {}

  async invoke(invocation: ToolInvocation): AsyncResult<ToolResult> {
    const requested = invocation.input["path"];
    const resolved = resolveInside(this.root, String(requested));
    if (!resolved.ok) return resolved;

    let text: string;
    try {
      const stat = await fs.stat(resolved.value);
      if (!stat.isFile()) {
        return toolError(
          "tool.ast.not_a_file",
          `"${String(requested)}" is not a regular file`,
        );
      }
      if (stat.size > MAX_AST_FILE_BYTES) {
        return toolError(
          "tool.ast.too_large",
          `"${String(requested)}" is ${stat.size} bytes; AST inspection is capped at ${MAX_AST_FILE_BYTES}`,
        );
      }
      text = await fs.readFile(resolved.value, "utf8");
    } catch (cause) {
      return toolError(
        "tool.ast.read_failed",
        `cannot read "${String(requested)}": ${cause instanceof Error ? cause.message : String(cause)}`,
        "not_found",
      );
    }

    const changedLines = invocation.input["changedLines"];
    const changed =
      Array.isArray(changedLines) &&
      changedLines.every((n) => typeof n === "number")
        ? new Set(changedLines as number[])
        : new Set<number>();

    const extracted = extractSymbols(String(requested), text, changed);
    return {
      ok: true,
      value: {
        output: {
          path: String(requested),
          imports: extracted.imports,
          exports: extracted.exports,
          symbols: extracted.symbols,
        },
      },
    };
  }
}
