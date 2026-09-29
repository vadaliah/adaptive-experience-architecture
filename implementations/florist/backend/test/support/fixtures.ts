import type { ToolDefinition } from "../../src/tools/tool-registry.js";


/**
 * Builds a minimal ToolDefinition for tests.
 */
export function createTestTool(
  overrides: Partial<ToolDefinition<any, any>> = {}
): ToolDefinition<any, any> {

  return {
    name: "testTool",

    description: "A test capability.",

    inputSchema: {
      type: "object",
      properties: {
        flag: { type: "boolean" }
      },
      required: ["flag"]
    },

    resultDefinition: {
      datasetField: "items",

      metadataSchema: {
        title: {
          type: "string",
          description: "Title description."
        },

        qualifiers: {
          type: "array",
          items: { type: "string" },
          description: "Qualifiers description."
        }
      }
    },

    execute: async () => ({ items: [] }),

    ...overrides
  };
}
