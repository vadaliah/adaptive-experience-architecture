import { getAllTools } from "./tool-registry.js";

export function getBedrockTools() {
  return getAllTools().map((tool) => ({
    toolSpec: {
      name: tool.name,
      description: tool.description,
      inputSchema: {
        json: tool.inputSchema
      }
    }
  }));
}