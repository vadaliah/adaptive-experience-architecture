import express from "express";
import cors from "cors";
import { z, ZodError } from "zod";
import type { AgentService } from "./services/agent-service.js";
import { CampaignNotFoundError } from "./services/campaign-service.js";
import type { CampaignService } from "./services/campaign-service.js";
import { createCampaignTools } from "./tools/campaign-tools.js";
import { randomUUID } from "node:crypto";
import { Orchestrator } from "./orchestration/orchestrator.js";
import { prepareCapability } from "./orchestration/capability-policy.js";
import type { InteractionContext } from "./orchestration/decision.js";

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
  const orchestrator = new Orchestrator();
  const direct = (name: string, input: object, requestId: string) => {
    const context: InteractionContext = {
      requestId,
      interactionSource: "ribbon",
      explicitCriteria:
        "campaignId" in input
          ? [{ kind: "campaign", campaignId: String(input.campaignId) }]
          : [],
    };
    return orchestrator.run(
      context,
      async () => ({ capability: name, input }),
      (proposal) =>
        prepareCapability(proposal, context, (key) =>
          key === "getCampaignProducts"
            ? tools.products
            : key === "listCampaigns"
              ? tools.list
              : undefined,
        ),
    );
  };
  app.use((req, res, next) => {
    const supplied = req.get("X-Request-ID");
    const requestId =
      supplied && /^[A-Za-z0-9_-]{1,100}$/.test(supplied)
        ? supplied
        : randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("X-Request-ID", requestId);
    next();
  });
  app.use(express.json());
  app.use(
    cors({ origin: "http://localhost:8081", exposedHeaders: ["X-Request-ID"] }),
  );
  app.get("/api/campaigns", async (_req, res, next) => {
    try {
      const result = await direct("listCampaigns", {}, res.locals.requestId);
      res.json({
        campaigns: result.dataset,
        requestId: result.requestId,
        trace: result.trace,
      });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/intent", async (req, res, next) => {
    try {
      const input = interaction.parse(req.body);
      if ("prompt" in input)
        return res.json(
          await agent.processIntent(input.prompt, res.locals.requestId),
        );
      return res.json(
        await direct("getCampaignProducts", input, res.locals.requestId),
      );
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
          .json({
            requestId: res.locals.requestId,
            error: "Provide only a prompt or a campaignId.",
          });
      if (error instanceof CampaignNotFoundError)
        return res
          .status(404)
          .json({ requestId: res.locals.requestId, error: error.message });
      console.error(
        JSON.stringify({
          event: "request_failed",
          requestId: res.locals.requestId,
        }),
      );
      return res
        .status(500)
        .json({
          requestId: res.locals.requestId,
          error: "Unable to process request.",
        });
    },
  );
  return app;
}
