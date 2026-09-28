import express from "express";
import cors from "cors";

import { AgentService } from "./services/agent-service.js";


/**
 * AEA HTTP Entry Point
 *
 * Receives user intent from the UI and delegates fulfillment
 * to the agent orchestration layer.
 */
const app = express();

app.use(express.json());

app.use(
    cors({
        origin: "http://localhost:8081"
    })
);

const agentService = new AgentService();


/**
 * Accept a natural-language user intent.
 *
 * The HTTP layer does not know which tool, repository,
 * or SQL query will be used.
 */
app.post(
    "/api/intent",
    async (req, res) => {
        try {
            const { prompt } = req.body;

            if (
                typeof prompt !== "string" ||
                !prompt.trim()
            ) {
                return res.status(400).json({
                    error: "prompt is required"
                });
            }

            const result =
                await agentService.processIntent(
                    prompt.trim()
                );

            return res.json(result);

        } catch (error) {
            console.error(
                "Intent processing failed:",
                error
            );

            return res.status(500).json({
                error: "Unable to process intent"
            });
        }
    }
);

const PORT =
    Number(process.env.PORT ?? 3001);

app.listen(PORT, () => {
    console.log(
        `AEA backend listening on port ${PORT}`
    );
});