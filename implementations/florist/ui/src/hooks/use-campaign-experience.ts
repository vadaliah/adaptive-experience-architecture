import { useEffect, useRef, useState } from "react";
import {
  campaignApi,
  type Campaign,
  type IntentResult,
} from "../services/campaign-api";
export function useCampaignExperience(api = campaignApi) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignLoading, setCampaignLoading] = useState(true);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [view, setView] = useState<{
    result: IntentResult | null;
    selectedCampaignId: string | null;
  }>({ result: null, selectedCampaignId: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    api
      .listCampaigns()
      .then((data) => {
        if (active) setCampaigns(data.campaigns);
      })
      .catch(() => {
        if (active)
          setCampaignError("Unable to load campaigns. Please reload.");
      })
      .finally(() => {
        if (active) setCampaignLoading(false);
      });
    return () => {
      active = false;
      revision.current++;
    };
  }, [api]);
  async function run(action: () => Promise<IntentResult>) {
    const id = ++revision.current;
    setLoading(true);
    setError(null);
    try {
      const result = await action();
      if (id === revision.current)
        setView({
          result,
          selectedCampaignId: result.presentation.selectedCampaignId,
        });
    } catch (e) {
      if (id === revision.current)
        setError(e instanceof Error ? e.message : "Unable to load results.");
    } finally {
      if (id === revision.current) setLoading(false);
    }
  }
  return {
    campaigns,
    campaignLoading,
    campaignError,
    ...view,
    loading,
    error,
    selectCampaign: (id: string) => run(() => api.getCampaignProducts(id)),
    submitPrompt: (prompt: string) => run(() => api.prompt(prompt)),
  };
}
