export interface Campaign {
  campaignId: string;
  campaignName: string;
  campaignDescription: string | null;
  displaySequence: number;
}
export interface IntentResult {
  kind: "products" | "campaigns" | "message";
  metadata: { title: string; qualifiers: string[]; resultCount: number };
  dataset: Record<string, unknown>[];
  // Presentation only. Never passed back as prompt context.
  presentation: { selectedCampaignId: string | null };
  message?: string;
}
const base = "http://localhost:3001/api";
async function request<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(
    `${base}${path}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  if (!response.ok)
    throw new Error(`Request failed with status ${response.status}`);
  return response.json();
}
export const campaignApi = {
  listCampaigns: () => request<{ campaigns: Campaign[] }>("/campaigns"),
  getCampaignProducts: (campaignId: string) =>
    request<IntentResult>("/intent", { campaignId }),
  prompt: (prompt: string) => request<IntentResult>("/intent", { prompt }),
};
