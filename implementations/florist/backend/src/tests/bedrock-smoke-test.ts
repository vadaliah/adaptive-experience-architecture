import { ClaudeService } from "../services/claude-service.js";

async function main(): Promise<void> {
  console.log("======================================================");
  console.log(" AEA Bedrock / Claude Smoke Test");
  console.log("======================================================");

  const claude = new ClaudeService();

  const response = await claude.invoke(
    "Respond with exactly: AEA Bedrock connection successful"
  );

  console.log();
  console.log("Claude response:");
  console.log(response.text);

  console.log();
  console.log("Metrics:");
  console.log(`Latency       : ${response.latencyMs} ms`);
  console.log(`Input tokens  : ${response.inputTokens ?? "n/a"}`);
  console.log(`Output tokens : ${response.outputTokens ?? "n/a"}`);
  console.log(`Total tokens  : ${response.totalTokens ?? "n/a"}`);
}

main().catch((error) => {
  console.error("AEA Bedrock smoke test FAILED");
  console.error(error);
  process.exit(1);
});