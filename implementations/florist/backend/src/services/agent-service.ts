import "../tools/search-products-tool.js";
import "../tools/campaign-tools.js";
import { ClaudeService } from "./claude-service.js";
import { campaignService, CampaignNotFoundError } from "./campaign-service.js";
import type { CampaignService } from "./campaign-service.js";
import type { Campaign } from "../repositories/campaign-repository.js";
import { getBedrockTools } from "../tools/bedrock-tools.js";
import { getTool } from "../tools/tool-registry.js";
import {
  campaignProductsResult,
  messageResult,
} from "../models/intent-result.js";
import type { IntentResult } from "../models/intent-result.js";
import { z } from "zod";

export type AgentResult = IntentResult;
export type ResultMetadata = IntentResult["metadata"];
const execution = z.object({
  request: z.unknown(),
  metadata: z.object({
    title: z.string().min(1),
    qualifiers: z.array(z.unknown()),
  }),
});
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
// Conservative evidence guard, not an occasion/category resolver. Never invent IDs/aliases.
export function campaignIsExplicit(
  prompt: string,
  campaign: Campaign,
): boolean {
  const text = ` ${normalize(prompt)} `;
  if (
    text.includes(` ${normalize(campaign.campaignId)} `) ||
    text.includes(` ${normalize(campaign.campaignName)} `)
  )
    return true;
  const generic = new Set([
    "lily",
    "lilys",
    "recommendations",
    "seasons",
    "season",
    "best",
    "featured",
    "gifts",
    "clearance",
    "items",
    "favorites",
  ]);
  // Distinctive campaign-name words support e.g. Valentine's Day / Valentine's Favorites.
  return normalize(campaign.campaignName)
    .split(" ")
    .some(
      (word) =>
        word.length >= 5 && !generic.has(word) && text.includes(` ${word} `),
    );
}

export class AgentService {
  constructor(
    private readonly claude: Pick<
      ClaudeService,
      "invokeWithTools"
    > = new ClaudeService(),
    private readonly campaigns: Pick<
      CampaignService,
      "listCampaigns"
    > = campaignService,
  ) {}

  async processIntent(prompt: string): Promise<AgentResult> {
    const { campaigns } = await this.campaigns.listCampaigns();
    const eligible = campaigns.filter((c) => campaignIsExplicit(prompt, c));
    const decision = await this.claude.invokeWithTools(
      prompt,
      getBedrockTools(),
      campaigns,
    );
    if (!decision.toolName)
      return messageResult(
        decision.text?.trim() ||
          "Please ask for the catalog or one of the available campaigns.",
      );
    const tool = getTool(decision.toolName);
    if (!tool)
      throw new Error(`Agent requested unknown tool: ${decision.toolName}`);
    const parsed = execution.safeParse(decision.toolInput);
    if (!parsed.success || !parsed.data.request)
      throw new Error("Agent returned an invalid execution contract.");
    const input = parsed.data;
    if (decision.toolName === "getCampaignProducts") {
      const request = z
        .object({ campaignId: z.string().min(1).max(50) })
        .strict()
        .safeParse(input.request);
      if (
        !request.success ||
        !eligible.some((c) => c.campaignId === request.data.campaignId)
      ) {
        return messageResult(
          "I couldn't identify an explicitly requested available campaign. Please choose one from the Campaign Ribbon or ask for the full catalog.",
        );
      }
      try {
        const result = (await tool.execute(request.data)) as Awaited<
          ReturnType<CampaignService["getCampaignProducts"]>
        >;
        return campaignProductsResult(result);
      } catch (error) {
        if (error instanceof CampaignNotFoundError)
          return messageResult(
            "That campaign is no longer available. Please refresh the campaign list.",
          );
        throw error;
      }
    }
    if (decision.toolName === "searchProducts") {
      const request = z
        .object({ returnAllProducts: z.literal(true) })
        .strict()
        .safeParse(input.request);
      if (!request.success)
        return messageResult(
          "I can show the full catalog or an available campaign. Other product filters are not supported yet.",
        );
    }
    const result = (await tool.execute(input.request)) as Record<
      string,
      unknown
    >;
    const dataset = result?.[tool.resultDefinition.datasetField];
    if (!Array.isArray(dataset))
      throw new Error(
        `Tool ${decision.toolName} did not return expected dataset field: ${tool.resultDefinition.datasetField}`,
      );
    return {
      kind: decision.toolName === "listCampaigns" ? "campaigns" : "products",
      metadata: {
        title:
          decision.toolName === "searchProducts"
            ? "Lily Product Catalog"
            : decision.toolName === "listCampaigns"
              ? "Marketing Campaigns"
              : input.metadata.title,
        qualifiers: [],
        resultCount: dataset.length,
      },
      dataset,
      presentation: { selectedCampaignId: null },
      ...(decision.toolName === "searchProducts"
        ? { message: "Showing the full catalog; no filters are applied." }
        : {}),
    };
  }
}
