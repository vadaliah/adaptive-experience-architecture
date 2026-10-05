import { createApp } from "../../src/app.js";
import type { AddressInfo } from "node:net";
import { afterAll, it, expect, vi } from "vitest";
import pg from "pg";
import { CampaignRepository } from "../../src/repositories/campaign-repository.js";
import { CampaignService } from "../../src/services/campaign-service.js";
// This suite is run only by run-integration.py against its own temporary Unix socket.
if (!process.env.CAMPAIGN_TEST_SOCKET?.includes("lily-campaign-test-"))
  throw new Error("Disposable test cluster required");
const pool = new pg.Pool({
  host: process.env.CAMPAIGN_TEST_SOCKET,
  database: "postgres",
  user: process.env.CAMPAIGN_TEST_USER,
  port: 5432,
  ssl: false,
});
const repo = new CampaignRepository(pool),
  service = new CampaignService(repo);
afterAll(() => pool.end());
it("lists exactly the five seeded campaigns in deterministic order", async () => {
  const { campaigns } = await service.listCampaigns();
  expect(campaigns.map((c) => [c.campaignId, c.campaignName])).toEqual([
    ["CMP001", "Lily's Recommendations"],
    ["CMP002", "Season's Best"],
    ["CMP003", "Clearance Items"],
    ["CMP004", "Featured Gifts"],
    ["CMP005", "Valentine's Favorites"],
  ]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE marketing_campaign SET display_sequence=1");
    expect(
      (await new CampaignRepository(client).listCampaigns()).map(
        (c) => c.campaignId,
      ),
    ).toEqual(["CMP001", "CMP002", "CMP003", "CMP004", "CMP005"]);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
it.each([
  ["CMP001", ["P001", "P002", "P007", "P013", "P018", "P020", "P024"]],
  ["CMP002", ["P003", "P005", "P017", "P021", "P025"]],
  ["CMP003", ["P009", "P010"]],
  ["CMP004", ["P007", "P008", "P011", "P012", "P013", "P014", "P015", "P023"]],
  ["CMP005", ["P001", "P002", "P011", "P013", "P016", "P020"]],
])(
  "returns exactly assigned products for %s including prices and inventory",
  async (campaignId, ids) => {
    const { products } = await service.getCampaignProducts({ campaignId });
    expect(products.map((p) => p.productId).sort()).toEqual(ids);
    for (const product of products) {
      expect(typeof product.priceUsd).toBe("number");
      expect(typeof product.quantity).toBe("number");
    }
  },
);
it("preserves catalog and all 28 relationships", async () => {
  expect(
    Number((await pool.query("SELECT count(*) n FROM product")).rows[0].n),
  ).toBe(25);
  expect(
    Number(
      (await pool.query("SELECT count(*) n FROM product_campaign_assignment"))
        .rows[0].n,
    ),
  ).toBe(28);
  await expect(
    service.getCampaignProducts({ campaignId: "CMP999" }),
  ).rejects.toThrow("not available");
});

it("HTTP discovery and explicit selection bypass agent; prompt carries no selection", async () => {
  const agent = {
    processIntent: vi
      .fn()
      .mockImplementation(async (_prompt: string, requestId: string) => ({
        kind: "message",
        requestId,
      })),
  };
  const server = createApp(agent, service).listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (body: object) =>
    fetch(base + "/api/intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": "http-test-123",
      },
      body: JSON.stringify(body),
    });
  try {
    expect(
      ((await (await fetch(base + "/api/campaigns")).json()) as any).campaigns,
    ).toHaveLength(5);
    const result = (await (await post({ campaignId: "CMP005" })).json()) as any;
    expect(result.dataset.map((p: any) => p.productId).sort()).toEqual([
      "P001",
      "P002",
      "P011",
      "P013",
      "P016",
      "P020",
    ]);
    expect(result.metadata.qualifiers).toEqual([
      "Campaign: Valentine's Favorites",
    ]);
    expect(result.requestId).toBe("http-test-123");
    expect(result.trace).toMatchObject({
      requestId: "http-test-123",
      interactionSource: "ribbon",
      proposedCapability: "getCampaignProducts",
      explicitCriteria: [{ kind: "campaign", campaignId: "CMP005" }],
      validatedArguments: { campaignId: "CMP005" },
      executedCapabilities: ["getCampaignProducts"],
      appliedCriteria: [{ kind: "campaign", campaignId: "CMP005" }],
      resultCount: 6,
      outcome: "succeeded",
    });
    expect(agent.processIntent).not.toHaveBeenCalled();
    await post({ prompt: "show everything" });
    expect(agent.processIntent).toHaveBeenCalledExactlyOnceWith(
      "show everything",
      "http-test-123",
    );
    expect((await post({ prompt: "hello", campaignId: "CMP005" })).status).toBe(
      400,
    );
    expect(
      (await post({ prompt: "hello", filters: { campaignId: "CMP005" } }))
        .status,
    ).toBe(400);
    expect((await post({ campaignId: "missing" })).status).toBe(404);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
