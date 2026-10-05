import { createApp } from "./app.js";
import { AgentService } from "./services/agent-service.js";
import { campaignService } from "./services/campaign-service.js";
const app = createApp(new AgentService(), campaignService);
const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`AEA backend listening on port ${port}`));
