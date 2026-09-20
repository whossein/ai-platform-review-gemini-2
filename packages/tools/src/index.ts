/**
 * @ai-review/tools
 *
 * First-party, MCP-aligned tool implementations (Phase 4, ADR-0009).
 * Read-only by design in this phase: every tool here requires only the
 * `filesystem_read` capability and never writes.
 *
 *   - `ReadFileTool`    — bounded UTF-8 file read, traversal-guarded.
 *   - `ListFilesTool`   — bounded recursive listing (noise dirs skipped).
 *   - `SearchFilesTool` — bounded regex content search.
 *   - `AstSymbolsTool`  — TS/JS structural extraction (imports/exports/symbols).
 */

export {
  ListFilesTool,
  ReadFileTool,
  SearchFilesTool,
  resolveInside,
  toolError,
} from "./fs.js";
export { AstSymbolsTool, extractSymbols } from "./ast.js";
