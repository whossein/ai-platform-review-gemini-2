# @ai-review/tools

First-party, MCP-aligned tool implementations (Phase 4, ADR-0009).
All tools in this phase are read-only and require the `filesystem_read` capability.

## Tools Provided

- `ReadFileTool` (`tool.fs.read`): Safe, path-traversal guarded file reader with byte size capping.
- `ListFilesTool` (`tool.fs.list`): Safe workspace file enumerator ignoring noise directories (`node_modules`, `dist`, `.git`).
- `SearchFilesTool` (`tool.fs.search`): Safe bounded regex content search.
- `AstSymbolsTool` (`tool.ast.symbols`): TypeScript AST structural extraction for symbols, hooks, components, functions, classes, and types.

## Registry & Accessor

- `MapToolRegistry`: In-memory registry conforming to `ToolRegistry` from `@ai-review/core`.
- `createDefaultToolRegistry(workspaceRoot)`: Pre-populates all 4 first-party tools scoped to workspace root.
- `createToolAccessor(registry)`: Wraps a tool registry in a `ToolAccessor`.
