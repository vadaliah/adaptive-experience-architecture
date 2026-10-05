import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTool } from "../../support/fixtures.js";

/*
 * ClaudeService is mocked: these tests supply Claude's decision
 * directly and verify AgentService's deterministic orchestration.
 */
const { invokeWithTools, ClaudeService, getTool, getBedrockTools } = vi.hoisted(
  () => {
    const invokeWithTools = vi.fn();

    const ClaudeService = vi.fn(function (this: any) {
      this.invokeWithTools = invokeWithTools;
    });

    return {
      invokeWithTools,
      ClaudeService,
      getTool: vi.fn(),
      getBedrockTools: vi.fn(),
    };
  },
);

vi.mock("../../../src/services/claude-service.js", () => ({
  ClaudeService,
}));

/*
 * agent-service imports this module for its registration side
 * effect, which would construct a CatalogRepository.
 */
vi.mock("../../../src/tools/search-products-tool.js", () => ({}));
vi.mock("../../../src/tools/campaign-tools.js", () => ({}));
vi.mock("../../../src/services/campaign-service.js", () => ({
  campaignService: {
    listCampaigns: async () => ({
      campaigns: [
        {
          campaignId: "CMP005",
          campaignName: "Valentine's Favorites",
          campaignDescription: "Romantic favorites",
          displaySequence: 5,
        },
      ],
    }),
  },
  CampaignNotFoundError: class extends Error {},
}));

vi.mock("../../../src/tools/tool-registry.js", () => ({
  getTool,
}));

vi.mock("../../../src/tools/bedrock-tools.js", () => ({
  getBedrockTools,
}));

import { AgentService } from "../../../src/services/agent-service.js";

const BEDROCK_TOOLS = [{ toolSpec: { name: "testTool" } }];

const VALID_INPUT = {
  request: { flag: true },
  metadata: {
    title: "Test Items",
    qualifiers: ["under $50"],
  },
};

function decide(toolInput: unknown, toolName = "testTool") {
  invokeWithTools.mockResolvedValue({
    toolName,
    toolInput,
    latencyMs: 0,
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
      execute: vi.fn().mockResolvedValue({ items }),
    });

    getTool.mockReturnValue(tool);
    decide(VALID_INPUT);

    const result = await new AgentService().processIntent("show me items");

    expect(result).toMatchObject({
      metadata: {
        title: "Test Items",
        qualifiers: [],
        resultCount: 3,
      },
      dataset: items,
      kind: "products",
      presentation: { selectedCampaignId: null },
    });
  });

  it("sends the prompt and Bedrock tool definitions to Claude", async () => {
    getTool.mockReturnValue(createTestTool());
    decide(VALID_INPUT);

    await new AgentService().processIntent("show me items");

    expect(ClaudeService).toHaveBeenCalledTimes(1);
    expect(invokeWithTools).toHaveBeenCalledWith(
      "show me items",
      BEDROCK_TOOLS,
      expect.arrayContaining([
        expect.objectContaining({ campaignId: "CMP005" }),
      ]),
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
    expect(execute).toHaveBeenCalledWith(VALID_INPUT.request, {
      requestId: expect.any(String),
    });
  });

  it("uses the tool's datasetField to locate the dataset", async () => {
    const orders = [{ orderId: "A" }];

    getTool.mockReturnValue(
      createTestTool({
        resultDefinition: {
          ...createTestTool().resultDefinition,
          datasetField: "orders",
        },
        execute: vi.fn().mockResolvedValue({
          items: [{ ignored: true }],
          orders,
        }),
      }),
    );

    decide(VALID_INPUT);

    const result = await new AgentService().processIntent("x");

    expect(result.dataset).toBe(orders);
    expect(result.metadata.resultCount).toBe(1);
  });

  it("derives resultCount from the dataset, including an empty dataset", async () => {
    getTool.mockReturnValue(
      createTestTool({
        execute: vi.fn().mockResolvedValue({ items: [] }),
      }),
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
      metadata: { title: "All Items", qualifiers: [] },
    });

    const result = await new AgentService().processIntent("x");

    expect(result.metadata.qualifiers).toEqual([]);
  });

  it("returns a message when Claude does not select a tool", async () => {
    invokeWithTools.mockResolvedValue({
      stopReason: "end_turn",
      text: "Hello!",
      latencyMs: 0,
    });

    await expect(
      new AgentService().processIntent("hello"),
    ).resolves.toMatchObject({ kind: "message", message: "Hello!" });

    expect(getTool).not.toHaveBeenCalled();
  });

  it("throws when Claude selects an unknown tool", async () => {
    getTool.mockReturnValue(undefined);
    decide(VALID_INPUT, "missingTool");

    await expect(new AgentService().processIntent("x")).rejects.toThrow(
      "Agent requested unknown tool: missingTool",
    );
  });

  describe("invalid execution contract", () => {
    const cases: Array<[string, unknown]> = [
      ["toolInput is undefined", undefined],
      ["toolInput is null", null],
      ["request is missing", { metadata: VALID_INPUT.metadata }],
      ["metadata is missing", { request: VALID_INPUT.request }],
      [
        "title is missing",
        { request: VALID_INPUT.request, metadata: { qualifiers: [] } },
      ],
      [
        "title is empty",
        {
          request: VALID_INPUT.request,
          metadata: { title: "", qualifiers: [] },
        },
      ],
      [
        "qualifiers is missing",
        { request: VALID_INPUT.request, metadata: { title: "T" } },
      ],
      [
        "qualifiers is not an array",
        {
          request: VALID_INPUT.request,
          metadata: { title: "T", qualifiers: "a" },
        },
      ],
    ];

    it.each(cases)("throws when %s", async (_label, toolInput) => {
      const execute = vi.fn();

      getTool.mockReturnValue(createTestTool({ execute }));
      decide(toolInput);

      await expect(new AgentService().processIntent("x")).rejects.toThrow(
        "Agent returned an invalid execution contract.",
      );

      expect(execute).not.toHaveBeenCalled();
    });
  });

  it("throws when the dataset field is not an array", async () => {
    getTool.mockReturnValue(
      createTestTool({
        name: "testTool",
        execute: vi.fn().mockResolvedValue({ items: "not-an-array" }),
      }),
    );

    decide(VALID_INPUT);

    await expect(new AgentService().processIntent("x")).rejects.toThrow(
      "Tool testTool did not return expected dataset field: items",
    );
  });

  it("throws when the dataset field is absent", async () => {
    getTool.mockReturnValue(
      createTestTool({
        execute: vi.fn().mockResolvedValue({}),
      }),
    );

    decide(VALID_INPUT);

    await expect(new AgentService().processIntent("x")).rejects.toThrow(
      "did not return expected dataset field: items",
    );
  });

  it("propagates tool execution errors", async () => {
    getTool.mockReturnValue(
      createTestTool({
        execute: vi.fn().mockRejectedValue(new Error("tool failed")),
      }),
    );

    decide(VALID_INPUT);

    await expect(new AgentService().processIntent("x")).rejects.toThrow(
      "tool failed",
    );
  });

  it("propagates Claude invocation errors", async () => {
    invokeWithTools.mockRejectedValue(new Error("bedrock down"));

    await expect(new AgentService().processIntent("x")).rejects.toThrow(
      "bedrock down",
    );
  });

  describe("untrusted tool results", () => {
    it.each([null, undefined])(
      "rejects invalid datasets when the tool returns %s",
      async (toolResult) => {
        getTool.mockReturnValue(
          createTestTool({
            execute: vi.fn().mockResolvedValue(toolResult),
          }),
        );

        decide(VALID_INPUT);

        await expect(new AgentService().processIntent("x")).rejects.toThrow(
          "did not return expected dataset field",
        );
      },
    );

    it("discards unverified model qualifiers", async () => {
      const qualifiers = ["valid", 42, null, { nested: true }];

      getTool.mockReturnValue(createTestTool());

      decide({
        request: VALID_INPUT.request,
        metadata: { title: "T", qualifiers },
      });

      const result = await new AgentService().processIntent("x");

      expect(result.metadata.qualifiers).toEqual([]);
    });
  });
});

describe("Campaign prompt grounding", () => {
  it("executes explicit Valentine's intent and discards invented qualifiers", async () => {
    const execute = vi.fn().mockResolvedValue({
      campaign: {
        campaignId: "CMP005",
        campaignName: "Valentine's Favorites",
      },
      products: [{ productId: "P001" }],
    });
    getTool.mockReturnValue(createTestTool({ execute }));
    decide(
      {
        request: { campaignId: "CMP005" },
        metadata: {
          title: "Under $75",
          qualifiers: ["under $75", "flowers only"],
        },
      },
      "getCampaignProducts",
    );
    const result = await new AgentService().processIntent(
      "Show me Valentine's Day flowers",
    );
    expect(execute).toHaveBeenCalledWith(
      { campaignId: "CMP005" },
      { requestId: result.requestId },
    );
    expect(result.metadata.qualifiers).toEqual([
      "Campaign: Valentine's Favorites",
    ]);
    expect(result.message).toContain("no additional");
  });
  it.each([
    "What do you have for Mother's Day?",
    "I need an anniversary arrangement",
    "show me something under $75",
  ])("rejects hallucinated campaign on %s", async (prompt) => {
    const execute = vi.fn();
    getTool.mockReturnValue(createTestTool({ execute }));
    decide(
      {
        request: { campaignId: "CMP005" },
        metadata: { title: "x", qualifiers: [] },
      },
      "getCampaignProducts",
    );
    expect((await new AgentService().processIntent(prompt)).kind).toBe(
      "message",
    );
    expect(execute).not.toHaveBeenCalled();
  });
  it("rejects invented IDs even on an explicit campaign prompt", async () => {
    const execute = vi.fn();
    getTool.mockReturnValue(createTestTool({ execute }));
    decide(
      {
        request: { campaignId: "CMP999" },
        metadata: { title: "x", qualifiers: [] },
      },
      "getCampaignProducts",
    );
    expect(
      (await new AgentService().processIntent("Valentine's Day")).kind,
    ).toBe("message");
    expect(execute).not.toHaveBeenCalled();
  });
});

it("correlates grounded agent proposal, validated arguments and executed campaign without model metadata", async () => {
  const execute = vi
    .fn()
    .mockResolvedValue({
      campaign: { campaignId: "CMP005", campaignName: "Valentine's Favorites" },
      products: [{ productId: "P001" }],
    });
  getTool.mockReturnValue(createTestTool({ execute }));
  decide(
    {
      request: { campaignId: "CMP005" },
      metadata: { title: "internal model claim", qualifiers: ["under $75"] },
    },
    "getCampaignProducts",
  );
  const result = await new AgentService().processIntent(
    "Valentine's flowers under $75",
    "prompt-123",
  );
  expect(result.trace).toEqual({
    requestId: "prompt-123",
    interactionSource: "prompt",
    explicitCriteria: [{ kind: "campaign", campaignId: "CMP005" }],
    proposedCapability: "getCampaignProducts",
    validatedArguments: { campaignId: "CMP005" },
    executedCapabilities: ["getCampaignProducts"],
    appliedCriteria: [{ kind: "campaign", campaignId: "CMP005" }],
    outcome: "succeeded",
    resultCount: 1,
    validation: "grounded_campaign",
  });
  expect(JSON.stringify(result.trace)).not.toContain("under $75");
  expect(execute).toHaveBeenCalledWith(
    { campaignId: "CMP005" },
    { requestId: "prompt-123" },
  );
});
it("records a rejected proposal with no execution or applied criteria", async () => {
  const execute = vi.fn();
  getTool.mockReturnValue(createTestTool({ execute }));
  decide(
    {
      request: { campaignId: "CMP999" },
      metadata: { title: "x", qualifiers: [] },
    },
    "getCampaignProducts",
  );
  const result = await new AgentService().processIntent(
    "Valentine's flowers",
    "rejected-123",
  );
  expect(result.trace).toMatchObject({
    requestId: "rejected-123",
    proposedCapability: "getCampaignProducts",
    validatedArguments: null,
    executedCapabilities: [],
    appliedCriteria: [],
    outcome: "rejected",
    resultCount: 0,
  });
  expect(execute).not.toHaveBeenCalled();
});
it("does not preserve campaign criteria between prompt interactions", async () => {
  const execute = vi
    .fn()
    .mockResolvedValue({
      campaign: { campaignId: "CMP005", campaignName: "Valentine's Favorites" },
      products: [],
    });
  getTool.mockReturnValue(createTestTool({ execute }));
  decide(
    {
      request: { campaignId: "CMP005" },
      metadata: { title: "x", qualifiers: [] },
    },
    "getCampaignProducts",
  );
  const agent = new AgentService();
  await agent.processIntent("Valentine's flowers", "first");
  const next = await agent.processIntent("show something under $75", "second");
  expect(next.trace).toMatchObject({
    requestId: "second",
    explicitCriteria: [],
    appliedCriteria: [],
    executedCapabilities: [],
    outcome: "rejected",
  });
  expect(execute).toHaveBeenCalledTimes(1);
});
