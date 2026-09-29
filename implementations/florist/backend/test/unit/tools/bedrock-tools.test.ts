import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTool } from "../../support/fixtures.js";


type Registry = typeof import("../../../src/tools/tool-registry.js");
type BedrockTools = typeof import("../../../src/tools/bedrock-tools.js");

let registry: Registry;
let bedrockTools: BedrockTools;


/*
 * Uses the real registry. A fresh module graph per test keeps
 * registrations isolated.
 */
beforeEach(async () => {
  vi.resetModules();
  registry = await import("../../../src/tools/tool-registry.js");
  bedrockTools = await import("../../../src/tools/bedrock-tools.js");
});


describe("getBedrockTools", () => {

  it("returns an empty list when no tools are registered", () => {
    expect(bedrockTools.getBedrockTools()).toEqual([]);
  });


  it("wraps a tool's request and metadata schemas in the execution contract", () => {
    const tool = createTestTool({
      name: "alpha",
      description: "Alpha capability."
    });

    registry.appendTool(tool);

    expect(bedrockTools.getBedrockTools()).toEqual([
      {
        toolSpec: {
          name: "alpha",
          description: "Alpha capability.",
          inputSchema: {
            json: {
              type: "object",
              properties: {
                request: tool.inputSchema,
                metadata: {
                  type: "object",
                  properties: tool.resultDefinition.metadataSchema,
                  required: ["title", "qualifiers"]
                }
              },
              required: ["request", "metadata"]
            }
          }
        }
      }
    ]);
  });


  it("passes the capability input schema through unchanged", () => {
    const tool = createTestTool({ name: "alpha" });

    registry.appendTool(tool);

    const [spec] = bedrockTools.getBedrockTools();

    expect(spec!.toolSpec.inputSchema.json.properties.request).toBe(
      tool.inputSchema
    );

    expect(spec!.toolSpec.inputSchema.json.properties.metadata.properties).toBe(
      tool.resultDefinition.metadataSchema
    );
  });


  it("maps each registered tool in registration order", () => {
    registry.appendTool(createTestTool({ name: "alpha" }));
    registry.appendTool(createTestTool({ name: "beta" }));

    const names = bedrockTools
      .getBedrockTools()
      .map((spec) => spec.toolSpec.name);

    expect(names).toEqual(["alpha", "beta"]);
  });
});
