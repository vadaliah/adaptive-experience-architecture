import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignRepository } from "../../src/repositories/campaign-repository.js";
import { CampaignService } from "../../src/services/campaign-service.js";
import { createCampaignTools } from "../../src/tools/campaign-tools.js";
const campaign = {
  campaignId: "CMP005",
  campaignName: "Valentine's Favorites",
  campaignDescription: "Romantic favorites",
  displaySequence: 5,
};
const product = {
  productId: "P001",
  productName: "Roses",
  productDescription: null,
  productType: "Flowers",
  priceUsd: 90,
  quantity: 2,
};
const store = {
  listCampaigns: vi.fn(),
  findCampaign: vi.fn(),
  getCampaignProducts: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  store.listCampaigns.mockResolvedValue([campaign]);
  store.findCampaign.mockResolvedValue(campaign);
  store.getCampaignProducts.mockResolvedValue([product]);
});
it("service and both tools use the same repository", async () => {
  const service = new CampaignService(store),
    tools = createCampaignTools(service);
  expect(await tools.list.execute({})).toEqual({ campaigns: [campaign] });
  expect(await tools.products.execute({ campaignId: "CMP005" })).toEqual({
    campaign,
    products: [product],
  });
  expect(store.getCampaignProducts).toHaveBeenCalledWith("CMP005");
});
it.each([{}, { campaignId: "fake", maxPrice: 75 }, { campaignId: 3 }])(
  "rejects unsupported arguments %j",
  async (input) => {
    await expect(
      new CampaignService(store).getCampaignProducts(input),
    ).rejects.toThrow();
    expect(store.getCampaignProducts).not.toHaveBeenCalled();
  },
);
it("rejects unknown IDs before product access", async () => {
  store.findCampaign.mockResolvedValue(undefined);
  await expect(
    new CampaignService(store).getCampaignProducts({ campaignId: "fake" }),
  ).rejects.toThrow("not available");
  expect(store.getCampaignProducts).not.toHaveBeenCalled();
});
it("repository parameterizes membership and maps string product IDs", async () => {
  const query = vi
    .fn()
    .mockResolvedValue({
      rows: [
        {
          product_id: "P001",
          product_name: "Roses",
          product_price_usd: "90.00",
          quantity: 2,
        },
      ],
    });
  const repo = new CampaignRepository({ query } as any);
  expect((await repo.getCampaignProducts("CMP005"))[0]).toMatchObject({
    productId: "P001",
    priceUsd: 90,
  });
  expect(query).toHaveBeenCalledWith(
    expect.stringMatching(
      /FROM product_campaign_assignment[\s\S]*WHERE a.campaign_id = \$1/,
    ),
    ["CMP005"],
  );
  query.mockResolvedValue({ rows: [campaign] });
  await repo.listCampaigns();
  expect(query).toHaveBeenLastCalledWith(
    expect.stringContaining("ORDER BY display_sequence, campaign_id"),
  );
});
