import "../tools/search-products-tool.js";

import { ClaudeService } from "../services/claude-service.js";
import { getBedrockTools } from "../tools/bedrock-tools.js";
import { getTool } from "../tools/tool-registry.js";

async function main(): Promise<void> {
  console.log("==========================================");
  console.log(" AEA Agentic Function Calling Test");
  console.log("==========================================");

  const prompt = "Show me everything Lily has to offer.";

  console.log("\nUser:");
  console.log(prompt);

  const claude = new ClaudeService();

  const result = await claude.invokeWithTools(
    prompt,
    getBedrockTools()
  );

  console.log("\nClaude decision:");
  console.log(JSON.stringify(result, null, 2));

  if (!result.toolName) {
    console.log("\nClaude did not select a tool.");
    return;
  }

  const tool = getTool(result.toolName);

  if (!tool) {
    throw new Error(
      `Claude requested unknown tool: ${result.toolName}`
    );
  }

  console.log(`\nExecuting tool: ${result.toolName}`);

  const toolResult = await tool.execute(
    result.toolInput
  );

  console.log("\nTool result:");
  console.log(JSON.stringify(toolResult, null, 2));
}

main().catch((error) => {
  console.error("\nAgentic function test FAILED");
  console.error(error);
  process.exit(1);
});