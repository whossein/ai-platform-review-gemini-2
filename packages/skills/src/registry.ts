/**
 * Skill Registry and Accessor implementations (Phase 4, ADR-0003).
 */

import type {
  Skill,
  SkillAccessor,
  SkillDescriptor,
  SkillId,
  SkillInput,
  SkillOutput,
  SkillRegistry,
  AsyncResult,
} from "@ai-review/core";
import { contributingComplianceSkill } from "./contributing.js";
import { analyzeImportsSkill } from "./imports.js";
import { inspectSymbolSkill } from "./symbols.js";
import { diffAnalysisSkill } from "./diff.js";

/** Map-backed SkillRegistry for storing and looking up skills by SkillId. */
export class MapSkillRegistry implements SkillRegistry {
  private readonly skills = new Map<string, Skill>();

  register(skill: Skill): void {
    this.skills.set(skill.descriptor.id, skill);
  }

  get(id: SkillId): Skill | undefined {
    return this.skills.get(id);
  }

  list(): readonly SkillDescriptor[] {
    return Array.from(this.skills.values()).map((s) => s.descriptor);
  }
}

/** Creates a skill registry populated with all standard first-party skills. */
export function createDefaultSkillRegistry(): MapSkillRegistry {
  const registry = new MapSkillRegistry();
  registry.register(contributingComplianceSkill);
  registry.register(analyzeImportsSkill);
  registry.register(inspectSymbolSkill);
  registry.register(diffAnalysisSkill);
  return registry;
}

/** Wraps a SkillRegistry into a SkillAccessor suitable for execution contexts. */
export function createSkillAccessor(registry: SkillRegistry): SkillAccessor {
  return {
    execute: (input: SkillInput): AsyncResult<SkillOutput> => {
      const skill = registry.get(input.skillId);
      if (!skill) {
        return Promise.resolve({
          ok: false,
          error: {
            category: "not_found",
            code: "skill.not_found",
            message: `skill "${input.skillId}" not found in registry`,
          },
        });
      }
      return skill.execute(input);
    },
    available: () => registry.list(),
  };
}
