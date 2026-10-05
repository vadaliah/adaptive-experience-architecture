import type { Campaign } from "../repositories/campaign-repository.js";
import type { ProductRecord } from "../repositories/catalog-repository.js";
export interface IntentResult {
  kind: "products" | "campaigns" | "message";
  metadata: { title: string; qualifiers: string[]; resultCount: number };
  dataset: unknown[];
  // Presentation of this response only. Never supplied to subsequent prompts.
  presentation: { selectedCampaignId: string | null };
  message?: string;
}
export function campaignProductsResult(result: {
  campaign: Campaign;
  products: ProductRecord[];
}): IntentResult {
  return {
    kind: "products",
    metadata: {
      title: result.campaign.campaignName,
      qualifiers: [`Campaign: ${result.campaign.campaignName}`],
      resultCount: result.products.length,
    },
    dataset: result.products,
    presentation: { selectedCampaignId: result.campaign.campaignId },
    message:
      "Showing all products assigned to this campaign; no additional filters are applied.",
  };
}
export function messageResult(message: string): IntentResult {
  return {
    kind: "message",
    message,
    metadata: { title: "Lily", qualifiers: [], resultCount: 0 },
    dataset: [],
    presentation: { selectedCampaignId: null },
  };
}
