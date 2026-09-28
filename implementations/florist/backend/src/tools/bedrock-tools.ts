import { getAllTools } from "./tool-registry.js";


/**
 * Converts registered AEA capabilities into the tool
 * definitions exposed to Bedrock.
 *
 * The application capability defines its own functional
 * input schema and result definition.
 *
 * Bedrock receives an Agentic Execution Contract containing:
 *
 *   request  - capability-specific execution criteria
 *   metadata - semantic description of the expected result
 */
export function getBedrockTools() {

  return getAllTools().map((tool) => ({

    toolSpec: {

      name: tool.name,

      description: tool.description,

      inputSchema: {
        json: {

          type: "object",

          properties: {

            request: tool.inputSchema,

            metadata: {
              type: "object",

              properties:
                tool.resultDefinition.metadataSchema,

              required: [
                "title",
                "qualifiers"
              ]
            }
          },

          required: [
            "request",
            "metadata"
          ]
        }
      }
    }
  }));
}