import { z } from "zod";
import { CampaignRepository } from "../repositories/campaign-repository.js";
import type { CampaignStore } from "../repositories/campaign-repository.js";

export const campaignRequest = z
  .object({ campaignId: z.string().trim().min(1).max(50) })
  .strict();
export class CampaignNotFoundError extends Error {}
export class CampaignService {
  constructor(
    private readonly repository: CampaignStore = new CampaignRepository(),
  ) {}
  async listCampaigns() {
    return { campaigns: await this.repository.listCampaigns() };
  }
  async getCampaignProducts(input: unknown) {
    const { campaignId } = campaignRequest.parse(input);
    const campaign = await this.repository.findCampaign(campaignId);
    if (!campaign)
      throw new CampaignNotFoundError("Campaign is not available.");
    return {
      campaign,
      products: await this.repository.getCampaignProducts(campaignId),
    };
  }
}
export const campaignService = new CampaignService();
