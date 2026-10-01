/**
 * Imports & Dependency Analysis Skill (Phase 4, ADR-0003).
 *
 * Inspects imports across changed files or ContextSlice, flagging deep traversal,
 * forbidden or sensitive imports, circular patterns, and external packages.
 */

import type {
  Skill,
  SkillId,
  SkillInput,
  SkillOutput,
  AsyncResult,
  FileContext,
  ContextSlice,
} from "@ai-review/core";

export interface ImportIssue {
  readonly file: string;
  readonly specifier: string;
  readonly severity: "high" | "medium" | "low";
  readonly rule: string;
  readonly message: string;
}

export interface ImportAnalysisResult {
  readonly totalImports: number;
  readonly externalPackages: readonly string[];
  readonly internalModules: readonly string[];
  readonly issues: readonly ImportIssue[];
}

const SUSPICIOUS_PACKAGES = new Set([
  "child_process",
  "node:child_process",
  "vm",
  "node:vm",
]);

export const analyzeImportsSkill: Skill = {
  descriptor: {
    id: "skill.analysis.imports" as SkillId,
    name: "Analyze Imports & Dependencies",
    description:
      "Analyzes module imports from file contexts or context slices, detecting deep relative imports, sensitive packages, and external dependency usage.",
    inputSchema: {
      type: "object",
      properties: {
        slice: { type: "object", description: "ContextSlice object" },
        files: { type: "array", description: "Array of FileContext objects or raw import lists" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        totalImports: { type: "number" },
        externalPackages: { type: "array", items: { type: "string" } },
        internalModules: { type: "array", items: { type: "string" } },
        issues: { type: "array" },
      },
    },
  },
  async execute(input: SkillInput): AsyncResult<SkillOutput> {
    const slice = input.args.slice as ContextSlice | undefined;
    const fileContexts: FileContext[] = Array.isArray(input.args.files)
      ? (input.args.files as FileContext[])
      : slice?.files
        ? [...slice.files]
        : [];

    const external = new Set<string>();
    const internal = new Set<string>();
    const issues: ImportIssue[] = [];
    let totalCount = 0;

    for (const fc of fileContexts) {
      const filePath = fc.path || "unknown";
      const imports = fc.imports || [];

      for (const spec of imports) {
        totalCount++;

        // Relative import
        if (spec.startsWith(".")) {
          internal.add(spec);

          // Deep relative import check (more than 2 levels up)
          if (spec.startsWith("../../../") || spec.split("../").length > 3) {
            issues.push({
              file: filePath,
              specifier: spec,
              severity: "low",
              rule: "imports/deep-relative-traversal",
              message: `Deep relative import "${spec}" introduces tight coupling. Prefer path aliases or package imports.`,
            });
          }
        } else {
          // External package or node builtin
          external.add(spec);

          if (SUSPICIOUS_PACKAGES.has(spec)) {
            issues.push({
              file: filePath,
              specifier: spec,
              severity: "high",
              rule: "imports/sensitive-system-package",
              message: `Potentially dangerous system module "${spec}" imported. Ensure command injection guards are in place.`,
            });
          }
        }
      }
    }

    const result: ImportAnalysisResult = {
      totalImports: totalCount,
      externalPackages: Array.from(external).sort(),
      internalModules: Array.from(internal).sort(),
      issues,
    };

    return {
      ok: true,
      value: {
        result: result as unknown as Record<string, unknown>,
      },
    };
  },
};
