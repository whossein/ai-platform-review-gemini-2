/**
 * @ai-review/skills
 *
 * Reusable, composable pure capabilities for agents (Phase 4, ADR-0003).
 *
 *   - `contributingComplianceSkill` — PR/commit/branch/docs compliance
 *   - `analyzeImportsSkill`         — circularity, deep traversal, sensitive packages
 *   - `inspectSymbolSkill`          — AST hooks/components/functions classification
 *   - `diffAnalysisSkill`           — additions, deletions, risk categorization
 */

export {
  contributingComplianceSkill,
  contributingComplianceSkill as myAppSkill,
  type ContributingComplianceResult,
} from "./contributing.js";

export {
  analyzeImportsSkill,
  type ImportIssue,
  type ImportAnalysisResult,
} from "./imports.js";

export {
  inspectSymbolSkill,
  type SymbolClassification,
  type SymbolInspectionResult,
} from "./symbols.js";

export {
  diffAnalysisSkill,
  type DiffMetrics,
} from "./diff.js";

export {
  MapSkillRegistry,
  createDefaultSkillRegistry,
  createSkillAccessor,
} from "./registry.js";
