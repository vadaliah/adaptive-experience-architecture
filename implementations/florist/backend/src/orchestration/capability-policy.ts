import { z } from "zod";
import type { Campaign } from "../repositories/campaign-repository.js";
import type { CampaignService } from "../services/campaign-service.js";
import { CampaignNotFoundError } from "../services/campaign-service.js";
import { campaignProductsResult } from "../models/intent-result.js";
import type { ToolDefinition } from "../tools/tool-registry.js";
import type {
  Proposal,
  InteractionContext,
  ExecutionPlan,
} from "./decision.js";
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

const envelope = z.object({
  request: z.unknown(),
  metadata: z.object({
    title: z.string().min(1),
    qualifiers: z.array(z.unknown()),
  }),
});
// Adapts today's registered capabilities to a validated plan. Business services stay unaware of orchestration.
export async function prepareCapability(
  proposal: Proposal,
  context: InteractionContext,
  tools: (name: string) => ToolDefinition | undefined,
  campaigns: Campaign[] = [],
): Promise<ExecutionPlan> {
  if (!proposal.capability)
    return {
      kind: "message",
      outcome: "message",
      message:
        proposal.message?.trim() ||
        "Please ask for the catalog or one of the available campaigns.",
    };
  const name = proposal.capability;
  const tool = tools(name);
  if (!tool) throw new Error(`Agent requested unknown tool: ${name}`);
  let request = proposal.input;
  let title = name;
  if (context.interactionSource === "prompt") {
    const parsed = envelope.safeParse(proposal.input);
    if (!parsed.success || !parsed.data.request)
      throw new Error("Agent returned an invalid execution contract.");
    request = parsed.data.request;
    title = parsed.data.metadata.title;
  }
  if (name === "getCampaignProducts") {
    const parsed = z
      .object({ campaignId: z.string().trim().min(1).max(50) })
      .strict()
      .safeParse(request);
    const valid =
      parsed.success &&
      (context.interactionSource === "ribbon" ||
        (campaigns.some((c) => c.campaignId === parsed.data.campaignId) &&
          context.explicitCriteria.some(
            (c) => c.campaignId === parsed.data.campaignId,
          )));
    if (!valid || !parsed.success)
      return {
        kind: "message",
        outcome: "rejected",
        message:
          "I couldn't identify an explicitly requested available campaign. Please choose one from the Campaign Ribbon or ask for the full catalog.",
      };
    return {
      kind: "execute",
      arguments: parsed.data,
      validation:
        context.interactionSource === "prompt"
          ? "grounded_campaign"
          : "arguments_validated",
      appliedCriteria: [
        { kind: "campaign", campaignId: parsed.data.campaignId },
      ],
      execute: async () =>
        campaignProductsResult(
          (await tool.execute(parsed.data, {
            requestId: context.requestId,
          })) as Awaited<ReturnType<CampaignService["getCampaignProducts"]>>,
        ),
      rejectOnError: (error) =>
        context.interactionSource === "prompt" &&
        error instanceof CampaignNotFoundError
          ? "That campaign is no longer available. Please refresh the campaign list."
          : undefined,
    };
  }
  if (name === "searchProducts") {
    const parsed = z
      .object({ returnAllProducts: z.literal(true) })
      .strict()
      .safeParse(request);
    if (!parsed.success)
      return {
        kind: "message",
        outcome: "rejected",
        message:
          "I can show the full catalog or an available campaign. Other product filters are not supported yet.",
      };
    request = parsed.data;
  }
  if (name === "listCampaigns") request = z.object({}).strict().parse(request);
  return {
    kind: "execute",
    arguments: request as Record<string, unknown>,
    appliedCriteria: [],
    validation: "arguments_validated",
    execute: async () => {
      const result = (await tool.execute(request, {
        requestId: context.requestId,
      })) as Record<string, unknown>;
      const dataset = result?.[tool.resultDefinition.datasetField];
      if (!Array.isArray(dataset))
        throw new Error(
          `Tool ${name} did not return expected dataset field: ${tool.resultDefinition.datasetField}`,
        );
      return {
        kind: name === "listCampaigns" ? "campaigns" : "products",
        metadata: {
          title:
            name === "searchProducts"
              ? "Lily Product Catalog"
              : name === "listCampaigns"
                ? "Marketing Campaigns"
                : title,
          qualifiers: [],
          resultCount: dataset.length,
        },
        dataset,
        presentation: { selectedCampaignId: null },
        ...(name === "searchProducts"
          ? { message: "Showing the full catalog; no filters are applied." }
          : {}),
      };
    },
  };
}
