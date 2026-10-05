import { it, expect, vi } from "vitest";
import { Orchestrator } from "../../src/orchestration/orchestrator.js";
import { prepareCapability } from "../../src/orchestration/capability-policy.js";
import { CampaignNotFoundError } from "../../src/services/campaign-service.js";
import { messageResult } from "../../src/models/intent-result.js";
const context = {
  requestId: "request-1",
  interactionSource: "ribbon" as const,
  explicitCriteria: [{ kind: "campaign" as const, campaignId: "CMP005" }],
};
const proposal = {
  capability: "getCampaignProducts",
  input: { campaignId: "CMP005" },
};
const campaign = {
  campaignId: "CMP005",
  campaignName: "Valentine's Favorites",
  campaignDescription: null,
  displaySequence: 5,
};
const product = { productId: "P001" };
const tool = {
  name: "getCampaignProducts",
  description: "",
  inputSchema: {},
  resultDefinition: { datasetField: "products", metadataSchema: {} as any },
  execute: vi.fn(),
};
it("records direct ribbon execution without involving an agent and preserves business data", async () => {
  tool.execute.mockResolvedValue({ campaign, products: [product] });
  const log = vi.fn();
  const result = await new Orchestrator(log).run(
    context,
    async () => proposal,
    (p) => prepareCapability(p, context, () => tool),
  );
  expect(result.dataset).toEqual([product]);
  expect(result.metadata.qualifiers).toEqual([
    "Campaign: Valentine's Favorites",
  ]);
  expect(result.trace).toMatchObject({
    ...context,
    proposedCapability: "getCampaignProducts",
    validatedArguments: { campaignId: "CMP005" },
    executedCapabilities: ["getCampaignProducts"],
    appliedCriteria: context.explicitCriteria,
    outcome: "succeeded",
    resultCount: 1,
  });
  expect(log).toHaveBeenCalledExactlyOnceWith(result.trace);
  expect(tool.execute).toHaveBeenLastCalledWith(
    { campaignId: "CMP005" },
    { requestId: "request-1" },
  );
});
it("records failed execution without claiming criteria were applied", async () => {
  tool.execute.mockRejectedValue(new Error("database down"));
  const log = vi.fn();
  await expect(
    new Orchestrator(log).run(
      context,
      async () => proposal,
      (p) => prepareCapability(p, context, () => tool),
    ),
  ).rejects.toThrow("database down");
  expect(log).toHaveBeenCalledWith(
    expect.objectContaining({
      outcome: "failed",
      executedCapabilities: [],
      appliedCriteria: [],
      resultCount: 0,
    }),
  );
});
it("logging failure and mutation cannot affect the business result", async () => {
  const result = messageResult("hello");
  const orchestrator = new Orchestrator((trace) => {
    trace.requestId = "mutated";
    throw new Error("sink down");
  });
  const response = await orchestrator.run(
    { ...context, explicitCriteria: [] },
    async () => ({ capability: null }),
    async () => ({ kind: "message", message: "hello", outcome: "message" }),
  );
  expect(response.requestId).toBe("request-1");
  expect(response.trace.requestId).toBe("request-1");
  expect(response.dataset).toEqual(result.dataset);
  expect(response.message).toBe("hello");
});
it("handles a campaign disappearing after prompt validation without claiming execution", async () => {
  tool.execute.mockRejectedValue(new CampaignNotFoundError("gone"));
  const c = { ...context, interactionSource: "prompt" as const };
  const result = await new Orchestrator(() => {}).run(
    c,
    async () => ({
      ...proposal,
      input: {
        request: proposal.input,
        metadata: { title: "x", qualifiers: [] },
      },
    }),
    (p) => prepareCapability(p, c, () => tool, [campaign]),
  );
  expect(result.trace).toMatchObject({
    outcome: "rejected",
    validation: "grounded_campaign",
    executedCapabilities: [],
    appliedCriteria: [],
  });
});
it("a prompt after a ribbon selection has no implicit campaign criteria", async () => {
  tool.execute.mockResolvedValue({ campaign, products: [product] });
  const orchestrator = new Orchestrator(() => {});
  await orchestrator.run(
    context,
    async () => proposal,
    (p) => prepareCapability(p, context, () => tool),
  );
  const next = {
    requestId: "request-2",
    interactionSource: "prompt" as const,
    explicitCriteria: [],
  };
  const result = await orchestrator.run(
    next,
    async () => ({
      ...proposal,
      input: {
        request: proposal.input,
        metadata: { title: "x", qualifiers: [] },
      },
    }),
    (p) => prepareCapability(p, next, () => tool, [campaign]),
  );
  expect(result.trace).toMatchObject({
    requestId: "request-2",
    explicitCriteria: [],
    appliedCriteria: [],
    executedCapabilities: [],
    outcome: "rejected",
  });
});
