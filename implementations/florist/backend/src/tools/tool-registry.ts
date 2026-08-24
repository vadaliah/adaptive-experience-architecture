export type ToolDefinition<TInput = unknown, TResult = unknown> = {
    name: string;
    description: string;
    inputSchema: object;
    execute: (input: TInput) => Promise<TResult>;
  };
  
  const toolRegistry: Record<
    string,
    ToolDefinition<any, any>
  > = {};
  
  export function appendTool(
    tool: ToolDefinition<any, any>
  ): void {
    if (toolRegistry[tool.name]) {
      throw new Error(`Tool already exists: ${tool.name}`);
    }
  
    toolRegistry[tool.name] = tool;
  }
  
  export function getTool(name: string) {
    return toolRegistry[name];
  }
  
  export function getAllTools() {
    return Object.values(toolRegistry);
  }