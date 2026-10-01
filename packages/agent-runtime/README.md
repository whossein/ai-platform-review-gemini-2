# @ai-review/agent-runtime

Dynamic agent registration and execution runtime (Phase 4, ADR-0003).

## Guarantees Enforced

1. **Existence:** Agent must be registered in the `AgentRegistry`.
2. **Budget Gating:** Fails fast if the budget is already exhausted before execution.
3. **Capability Gating:** Agents only have access to tools and skills explicitly declared in their `allowedTools` and `allowedSkills`.
4. **Structured Output Validation:** Validates result schema, confidence bounds `[0, 1]`, and issue provenance.

## Binding

- `DefaultAgentRuntime`: Binds `AgentRegistry`, with optional `ToolRegistry` and `SkillRegistry`.
- `createToolAccessor(toolRegistry)`: Converts `ToolRegistry` to `ToolAccessor`.
- `createSkillAccessor(skillRegistry)`: Converts `SkillRegistry` to `SkillAccessor`.
