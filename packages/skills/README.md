# @ai-review/skills

Reusable, composable pure capabilities for agents (Phase 4, ADR-0003).

## Skills Provided

- `contributingComplianceSkill` (`skill.governance.contributing-compliance`): PR/commit/branch/docs compliance checker.
- `analyzeImportsSkill` (`skill.analysis.imports`): Inspects imports across file contexts or a `ContextSlice`, flagging deep relative traversal, sensitive packages, and external deps.
- `inspectSymbolSkill` (`skill.code.inspect-symbol`): Classifies hooks, components, functions, classes, and types from a `ContextSlice`, detecting changed signatures.
- `diffAnalysisSkill` (`skill.diff.analyze`): Computes line additions/deletions, total churn, hotspot files, and security risk levels.

## Registry & Accessor

- `MapSkillRegistry`: In-memory registry conforming to `SkillRegistry` from `@ai-review/core`.
- `createDefaultSkillRegistry()`: Registers all 4 first-party skills.
- `createSkillAccessor(registry)`: Wraps a skill registry in a `SkillAccessor`.
