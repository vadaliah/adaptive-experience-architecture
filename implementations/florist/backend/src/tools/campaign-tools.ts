import { z } from "zod";
import {
  campaignService,
  CampaignService,
} from "../services/campaign-service.js";
import { appendTool } from "./tool-registry.js";
import type { ToolDefinition } from "./tool-registry.js";

const metadataSchema = {
  title: { type: "string" as const, description: "A concise result heading." },
  qualifiers: {
    type: "array" as const,
    items: { type: "string" as const },
    description:
      "Only campaign membership is applied; no other filters are supported.",
  },
};
export function createCampaignTools(service: CampaignService) {
  const list: ToolDefinition = {
    name: "listCampaigns",
    description:
      "List the actual available marketing campaigns. Does not select a campaign.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    resultDefinition: { datasetField: "campaigns", metadataSchema },
    execute: async (input) => {
      z.object({}).strict().parse(input);
      return service.listCampaigns();
    },
  };
  const products: ToolDefinition = {
    name: "getCampaignProducts",
    description:
      "Retrieve all products assigned to an existing campaign explicitly requested in this prompt. Use only IDs from the supplied campaign records. Does not apply price, product-type, occasion or category filters.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string", minLength: 1, maxLength: 50 },
      },
      required: ["campaignId"],
      additionalProperties: false,
    },
    resultDefinition: { datasetField: "products", metadataSchema },
    execute: (input) => service.getCampaignProducts(input),
  };
  return { list, products };
}
const tools = createCampaignTools(campaignService);
appendTool(tools.list);
appendTool(tools.products);
