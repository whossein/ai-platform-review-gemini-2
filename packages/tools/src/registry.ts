/**
 * Tool Registry & Accessor implementations (Phase 4, ADR-0009).
 */

import type {
  Tool,
  ToolAccessor,
  ToolDescriptor,
  ToolId,
  ToolInvocation,
  ToolRegistry,
  ToolResult,
  AsyncResult,
} from "@ai-review/core";
import { ListFilesTool, ReadFileTool, SearchFilesTool } from "./fs.js";
import { AstSymbolsTool } from "./ast.js";

/** Map-backed ToolRegistry for storing and looking up tools by ToolId. */
export class MapToolRegistry implements ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.descriptor.id, tool);
  }

  get(id: ToolId): Tool | undefined {
    return this.tools.get(id);
  }

  list(): readonly ToolDescriptor[] {
    return Array.from(this.tools.values()).map((t) => t.descriptor);
  }
}

/** Creates a tool registry populated with all standard first-party read tools. */
export function createDefaultToolRegistry(workspaceRoot: string): MapToolRegistry {
  const registry = new MapToolRegistry();
  registry.register(new ReadFileTool(workspaceRoot));
  registry.register(new ListFilesTool(workspaceRoot));
  registry.register(new SearchFilesTool(workspaceRoot));
  registry.register(new AstSymbolsTool(workspaceRoot));
  return registry;
}

/** Wraps a ToolRegistry into a ToolAccessor suitable for execution contexts. */
export function createToolAccessor(registry: ToolRegistry): ToolAccessor {
  return {
    invoke: (invocation: ToolInvocation): AsyncResult<ToolResult> => {
      const tool = registry.get(invocation.toolId);
      if (!tool) {
        return Promise.resolve({
          ok: false,
          error: {
            category: "not_found",
            code: "tool.not_found",
            message: `tool "${invocation.toolId}" not found in registry`,
          },
        });
      }
      return tool.invoke(invocation);
    },
    available: () => registry.list(),
  };
}
