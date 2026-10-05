import "../tools/search-products-tool.js";
import "../tools/campaign-tools.js";
import { randomUUID } from "node:crypto";
import { ClaudeService } from "./claude-service.js";
import { campaignService } from "./campaign-service.js";
import type { CampaignService } from "./campaign-service.js";
import { getBedrockTools } from "../tools/bedrock-tools.js";
import { getTool } from "../tools/tool-registry.js";
import { Orchestrator } from "../orchestration/orchestrator.js";
import {
  prepareCapability,
  campaignIsExplicit,
} from "../orchestration/capability-policy.js";
import type {
  InteractionContext,
  InteractionResult,
} from "../orchestration/decision.js";
import type { Campaign } from "../repositories/campaign-repository.js";
export type AgentResult = InteractionResult;
export type ResultMetadata = InteractionResult["metadata"];
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
    private readonly orchestrator = new Orchestrator(),
  ) {}
  async processIntent(
    prompt: string,
    requestId: string = randomUUID(),
  ): Promise<AgentResult> {
    const context: InteractionContext = {
      requestId,
      interactionSource: "prompt",
      explicitCriteria: [],
    };
    let campaigns: Campaign[] = [];
    return this.orchestrator.run(
      context,
      async () => {
        ({ campaigns } = await this.campaigns.listCampaigns());
        context.explicitCriteria = campaigns
          .filter((c) => campaignIsExplicit(prompt, c))
          .map((c) => ({ kind: "campaign", campaignId: c.campaignId }));
        const decision = await this.claude.invokeWithTools(
          prompt,
          getBedrockTools(),
          campaigns,
        );
        return {
          capability: decision.toolName ?? null,
          input: decision.toolInput,
          message: decision.text,
        };
      },
      (proposal) => prepareCapability(proposal, context, getTool, campaigns),
    );
  }
}
