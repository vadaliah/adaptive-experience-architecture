export interface Campaign {
  campaignId: string;
  campaignName: string;
  campaignDescription: string | null;
  displaySequence: number;
}
export interface DecisionTrace {
  requestId: string;
  interactionSource: "ribbon" | "prompt";
  explicitCriteria: { kind: "campaign"; campaignId: string }[];
  proposedCapability: string | null;
  validatedArguments: Record<string, unknown> | null;
  executedCapabilities: string[];
  appliedCriteria: { kind: "campaign"; campaignId: string }[];
  outcome: "succeeded" | "message" | "rejected" | "failed";
  resultCount: number;
  validation: "not_executed" | "arguments_validated" | "grounded_campaign";
}
let sequence = 0;
export function createRequestId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `ui-${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}`
  );
}
export interface IntentResult {
  requestId: string;
  trace?: DecisionTrace;
  kind: "products" | "campaigns" | "message";
  metadata: { title: string; qualifiers: string[]; resultCount: number };
  dataset: Record<string, unknown>[];
  // Presentation only. Never passed back as prompt context.
  presentation: { selectedCampaignId: string | null };
  message?: string;
}
const base = "http://localhost:3001/api";
async function request<T extends { requestId: string }>(
  path: string,
  requestId: string,
  body?: object,
): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "X-Request-ID": requestId },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok)
    throw new Error(
      `Request ${requestId} failed with status ${response.status}`,
    );
  const result = (await response.json()) as T;
  if (result.requestId !== requestId)
    throw new Error(`Response correlation mismatch for ${requestId}`);
  return result;
}
export const campaignApi = {
  listCampaigns: (requestId = createRequestId()) =>
    request<{
      campaigns: Campaign[];
      requestId: string;
      trace?: DecisionTrace;
    }>("/campaigns", requestId),
  getCampaignProducts: (campaignId: string, requestId = createRequestId()) =>
    request<IntentResult>("/intent", requestId, { campaignId }),
  prompt: (prompt: string, requestId = createRequestId()) =>
    request<IntentResult>("/intent", requestId, { prompt }),
};
