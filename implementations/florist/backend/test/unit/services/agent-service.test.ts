import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTool } from "../../support/fixtures.js";


/*
 * ClaudeService is mocked: these tests supply Claude's decision
 * directly and verify AgentService's deterministic orchestration.
 */
const { invokeWithTools, ClaudeService, getTool, getBedrockTools } =
  vi.hoisted(() => {
    const invokeWithTools = vi.fn();

    const ClaudeService = vi.fn(function (this: any) {
      this.invokeWithTools = invokeWithTools;
    });

    return {
      invokeWithTools,
      ClaudeService,
      getTool: vi.fn(),
      getBedrockTools: vi.fn()
    };
  });

vi.mock("../../../src/services/claude-service.js", () => ({
  ClaudeService
}));

/*
 * agent-service imports this module for its registration side
 * effect, which would construct a CatalogRepository.
 */
vi.mock("../../../src/tools/search-products-tool.js", () => ({}));

vi.mock("../../../src/tools/tool-registry.js", () => ({
  getTool
}));

vi.mock("../../../src/tools/bedrock-tools.js", () => ({
  getBedrockTools
}));


import { AgentService } from "../../../src/services/agent-service.js";


const BEDROCK_TOOLS = [{ toolSpec: { name: "testTool" } }];

const VALID_INPUT = {
  request: { flag: true },
  metadata: {
    title: "Test Items",
    qualifiers: ["under $50"]
  }
};


function decide(toolInput: unknown, toolName = "testTool") {
  invokeWithTools.mockResolvedValue({
    toolName,
    toolInput,
    latencyMs: 0
  });
}


beforeEach(() => {
  invokeWithTools.mockReset();
  ClaudeService.mockClear();
  getTool.mockReset();
  getBedrockTools.mockReset();

  getBedrockTools.mockReturnValue(BEDROCK_TOOLS);
});


describe("AgentService.processIntent", () => {

  it("returns the Resulting Data Store for a valid execution contract", async () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

    const tool = createTestTool({
      execute: vi.fn().mockResolvedValue({ items })
    });

    getTool.mockReturnValue(tool);
    decide(VALID_INPUT);

    const result = await new AgentService().processIntent("show me items");

    expect(result).toEqual({
      metadata: {
        title: "Test Items",
        qualifiers: ["under $50"],
        resultCount: 3
      },
      dataset: items
    });
  });


  it("sends the prompt and Bedrock tool definitions to Claude", async () => {
    getTool.mockReturnValue(createTestTool());
    decide(VALID_INPUT);

    await new AgentService().processIntent("show me items");

    expect(ClaudeService).toHaveBeenCalledTimes(1);
    expect(invokeWithTools).toHaveBeenCalledWith(
      "show me items",
      BEDROCK_TOOLS
    );
  });


  it("resolves the tool Claude selected", async () => {
    getTool.mockReturnValue(createTestTool());
    decide(VALID_INPUT, "testTool");

    await new AgentService().processIntent("x");

    expect(getTool).toHaveBeenCalledWith("testTool");
  });


  it("executes only the request portion of the contract", async () => {
    const execute = vi.fn().mockResolvedValue({ items: [] });

    getTool.mockReturnValue(createTestTool({ execute }));
    decide(VALID_INPUT);

    await new AgentService().processIntent("x");

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(VALID_INPUT.request);
  });


  it("uses the tool's datasetField to locate the dataset", async () => {
    const orders = [{ orderId: "A" }];

    getTool.mockReturnValue(
      createTestTool({
        resultDefinition: {
          ...createTestTool().resultDefinition,
          datasetField: "orders"
        },
        execute: vi.fn().mockResolvedValue({
          items: [{ ignored: true }],
          orders
        })
      })
    );

    decide(VALID_INPUT);

    const result = await new AgentService().processIntent("x");

    expect(result.dataset).toBe(orders);
    expect(result.metadata.resultCount).toBe(1);
  });


  it("derives resultCount from the dataset, including an empty dataset", async () => {
    getTool.mockReturnValue(
      createTestTool({
        execute: vi.fn().mockResolvedValue({ items: [] })
      })
    );

    decide(VALID_INPUT);

    const result = await new AgentService().processIntent("x");

    expect(result.metadata.resultCount).toBe(0);
    expect(result.dataset).toEqual([]);
  });


  it("accepts an empty qualifiers array", async () => {
    getTool.mockReturnValue(createTestTool());

    decide({
      ...VALID_INPUT,
      metadata: { title: "All Items", qualifiers: [] }
    });

    const result = await new AgentService().processIntent("x");

    expect(result.metadata.qualifiers).toEqual([]);
  });


  it("throws when Claude does not select a tool", async () => {
    invokeWithTools.mockResolvedValue({
      stopReason: "end_turn",
      text: "Hello!",
      latencyMs: 0
    });

    await expect(
      new AgentService().processIntent("hello")
    ).rejects.toThrow("Agent did not select a tool.");

    expect(getTool).not.toHaveBeenCalled();
  });


  it("throws when Claude selects an unknown tool", async () => {
    getTool.mockReturnValue(undefined);
    decide(VALID_INPUT, "missingTool");

    await expect(
      new AgentService().processIntent("x")
    ).rejects.toThrow("Agent requested unknown tool: missingTool");
  });


  describe("invalid execution contract", () => {

    const cases: Array<[string, unknown]> = [
      ["toolInput is undefined", undefined],
      ["toolInput is null", null],
      ["request is missing", { metadata: VALID_INPUT.metadata }],
      ["metadata is missing", { request: VALID_INPUT.request }],
      [
        "title is missing",
        { request: VALID_INPUT.request, metadata: { qualifiers: [] } }
      ],
      [
        "title is empty",
        { request: VALID_INPUT.request, metadata: { title: "", qualifiers: [] } }
      ],
      [
        "qualifiers is missing",
        { request: VALID_INPUT.request, metadata: { title: "T" } }
      ],
      [
        "qualifiers is not an array",
        { request: VALID_INPUT.request, metadata: { title: "T", qualifiers: "a" } }
      ]
    ];


    it.each(cases)("throws when %s", async (_label, toolInput) => {
      const execute = vi.fn();

      getTool.mockReturnValue(createTestTool({ execute }));
      decide(toolInput);

      await expect(
        new AgentService().processIntent("x")
      ).rejects.toThrow("Agent returned an invalid execution contract.");

      expect(execute).not.toHaveBeenCalled();
    });
  });


  it("throws when the dataset field is not an array", async () => {
    getTool.mockReturnValue(
      createTestTool({
        name: "testTool",
        execute: vi.fn().mockResolvedValue({ items: "not-an-array" })
      })
    );

    decide(VALID_INPUT);

    await expect(
      new AgentService().processIntent("x")
    ).rejects.toThrow(
      "Tool testTool did not return expected dataset field: items"
    );
  });


  it("throws when the dataset field is absent", async () => {
    getTool.mockReturnValue(
      createTestTool({
        execute: vi.fn().mockResolvedValue({})
      })
    );

    decide(VALID_INPUT);

    await expect(
      new AgentService().processIntent("x")
    ).rejects.toThrow("did not return expected dataset field: items");
  });


  it("propagates tool execution errors", async () => {
    getTool.mockReturnValue(
      createTestTool({
        execute: vi.fn().mockRejectedValue(new Error("tool failed"))
      })
    );

    decide(VALID_INPUT);

    await expect(
      new AgentService().processIntent("x")
    ).rejects.toThrow("tool failed");
  });


  it("propagates Claude invocation errors", async () => {
    invokeWithTools.mockRejectedValue(new Error("bedrock down"));

    await expect(
      new AgentService().processIntent("x")
    ).rejects.toThrow("bedrock down");
  });


  describe("documented current behavior", () => {

    /*
     * A null or undefined tool result is dereferenced before the
     * dataset check, so it surfaces as a TypeError rather than
     * the "did not return expected dataset field" error.
     */
    it.each([null, undefined])(
      "throws a TypeError when the tool returns %s",
      async (toolResult) => {
        getTool.mockReturnValue(
          createTestTool({
            execute: vi.fn().mockResolvedValue(toolResult)
          })
        );

        decide(VALID_INPUT);

        await expect(
          new AgentService().processIntent("x")
        ).rejects.toThrow(TypeError);
      }
    );


    /*
     * Only Array.isArray(qualifiers) is checked; item types are
     * not validated and are passed through unchanged.
     */
    it("passes non-string qualifier items through unchanged", async () => {
      const qualifiers = ["valid", 42, null, { nested: true }];

      getTool.mockReturnValue(createTestTool());

      decide({
        request: VALID_INPUT.request,
        metadata: { title: "T", qualifiers }
      });

      const result = await new AgentService().processIntent("x");

      expect(result.metadata.qualifiers).toEqual(qualifiers);
    });
  });
});
