/**
 * Symbol Inspection Skill (Phase 4, ADR-0003).
 *
 * Inspects AST symbols and signatures from a ContextSlice or file context,
 * classifying functions, React components, hooks, and types, and identifying changed symbols.
 */

import type {
  Skill,
  SkillId,
  SkillInput,
  SkillOutput,
  AsyncResult,
  SymbolInfo,
  ContextSlice,
} from "@ai-review/core";

export interface SymbolClassification {
  readonly hooks: readonly SymbolInfo[];
  readonly components: readonly SymbolInfo[];
  readonly functions: readonly SymbolInfo[];
  readonly classes: readonly SymbolInfo[];
  readonly types: readonly SymbolInfo[];
  readonly other: readonly SymbolInfo[];
}

export interface SymbolInspectionResult {
  readonly totalSymbols: number;
  readonly changedSymbols: readonly SymbolInfo[];
  readonly classifications: SymbolClassification;
  readonly breakingChangeRisk: "low" | "medium" | "high";
  readonly observations: readonly string[];
}

export const inspectSymbolSkill: Skill = {
  descriptor: {
    id: "skill.code.inspect-symbol" as SkillId,
    name: "Inspect Code Symbols",
    description:
      "Inspects code symbols and signatures from a context slice, classifying hooks, components, and functions, and detecting changed signatures.",
    inputSchema: {
      type: "object",
      properties: {
        slice: { type: "object", description: "ContextSlice object" },
        symbols: { type: "array", description: "Optional explicit list of SymbolInfo objects" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        totalSymbols: { type: "number" },
        changedSymbols: { type: "array" },
        classifications: { type: "object" },
        breakingChangeRisk: { type: "string" },
        observations: { type: "array", items: { type: "string" } },
      },
    },
  },
  async execute(input: SkillInput): AsyncResult<SkillOutput> {
    const slice = input.args.slice as ContextSlice | undefined;
    let symbols: SymbolInfo[] = [];

    if (Array.isArray(input.args.symbols)) {
      symbols = input.args.symbols as SymbolInfo[];
    } else if (slice?.files) {
      for (const f of slice.files) {
        if (f.symbols) symbols.push(...f.symbols);
      }
    }

    const hooks: SymbolInfo[] = [];
    const components: SymbolInfo[] = [];
    const functions: SymbolInfo[] = [];
    const classes: SymbolInfo[] = [];
    const types: SymbolInfo[] = [];
    const other: SymbolInfo[] = [];
    const changed: SymbolInfo[] = [];
    const observations: string[] = [];

    for (const sym of symbols) {
      if (sym.changed) changed.push(sym);

      switch (sym.kind) {
        case "hook":
          hooks.push(sym);
          break;
        case "component":
          components.push(sym);
          break;
        case "function":
          functions.push(sym);
          break;
        case "class":
          classes.push(sym);
          break;
        case "type":
          types.push(sym);
          break;
        default:
          other.push(sym);
          break;
      }
    }

    if (hooks.length > 0) {
      observations.push(`Found ${hooks.length} React hook(s): ${hooks.map((h) => h.name).join(", ")}`);
    }
    if (components.length > 0) {
      observations.push(`Found ${components.length} React component(s): ${components.map((c) => c.name).join(", ")}`);
    }

    // Evaluate breaking change risk heuristic
    const changedExportedTypes = changed.filter(
      (s) => s.kind === "type" || s.kind === "function" || s.kind === "class"
    );
    let breakingChangeRisk: "low" | "medium" | "high" = "low";
    if (changedExportedTypes.length > 5) {
      breakingChangeRisk = "high";
      observations.push("High number of modified public symbols; check for breaking API changes.");
    } else if (changedExportedTypes.length > 0) {
      breakingChangeRisk = "medium";
    }

    const result: SymbolInspectionResult = {
      totalSymbols: symbols.length,
      changedSymbols: changed,
      classifications: {
        hooks,
        components,
        functions,
        classes,
        types,
        other,
      },
      breakingChangeRisk,
      observations,
    };

    return {
      ok: true,
      value: {
        result: result as unknown as Record<string, unknown>,
      },
    };
  },
};
