import express from "express";
import cors from "cors";
import { z, ZodError } from "zod";
import type { AgentService } from "./services/agent-service.js";
import { CampaignNotFoundError } from "./services/campaign-service.js";
import type { CampaignService } from "./services/campaign-service.js";
import { createCampaignTools } from "./tools/campaign-tools.js";
import { campaignProductsResult } from "./models/intent-result.js";

const interaction = z.union([
  z.object({ prompt: z.string().trim().min(1).max(4000) }).strict(),
  z.object({ campaignId: z.string().trim().min(1).max(50) }).strict(),
]);
export function createApp(
  agent: Pick<AgentService, "processIntent">,
  campaigns: CampaignService,
) {
  const app = express();
  const tools = createCampaignTools(campaigns);
  app.use(express.json());
  app.use(cors({ origin: "http://localhost:8081" }));
  app.get("/api/campaigns", async (_req, res, next) => {
    try {
      res.json(await tools.list.execute({}));
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/intent", async (req, res, next) => {
    try {
      const input = interaction.parse(req.body);
      if ("prompt" in input)
        return res.json(await agent.processIntent(input.prompt));
      const result = (await tools.products.execute(input)) as Awaited<
        ReturnType<CampaignService["getCampaignProducts"]>
      >;
      return res.json(campaignProductsResult(result));
    } catch (error) {
      next(error);
    }
  });
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof ZodError)
        return res
          .status(400)
          .json({ error: "Provide only a prompt or a campaignId." });
      if (error instanceof CampaignNotFoundError)
        return res.status(404).json({ error: error.message });
      console.error("Request failed:", error);
      return res.status(500).json({ error: "Unable to process request." });
    },
  );
  return app;
}
