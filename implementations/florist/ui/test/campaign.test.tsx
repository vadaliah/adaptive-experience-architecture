import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  renderHook,
  act,
  waitFor,
} from "@testing-library/react";
import { CampaignRibbon } from "../src/components/campaign-ribbon";
import { useCampaignExperience } from "../src/hooks/use-campaign-experience";
import { campaignApi, type IntentResult } from "../src/services/campaign-api";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const campaigns = [
  {
    campaignId: "CMP005",
    campaignName: "Valentine's Favorites",
    campaignDescription: null,
    displaySequence: 5,
  },
];
const result: IntentResult = {
  requestId: "fixture",
  kind: "products",
  metadata: { title: "Campaign", qualifiers: [], resultCount: 1 },
  dataset: [{ productId: "P001" }],
  presentation: { selectedCampaignId: "CMP005" },
};
it("renders loading, error and empty states", () => {
  const props = {
    campaigns: [],
    selectedCampaignId: null,
    onSelect: vi.fn(),
    error: null,
    loading: true,
  };
  const { rerender } = render(<CampaignRibbon {...props} />);
  expect(screen.getByText("Loading campaigns…")).toBeTruthy();
  rerender(<CampaignRibbon {...props} loading={false} error="Failed" />);
  expect(screen.getByRole("alert").textContent).toBe("Failed");
  rerender(<CampaignRibbon {...props} loading={false} />);
  expect(screen.getByText("No campaigns available.")).toBeTruthy();
});
it("is controlled and emits only a campaign ID", () => {
  const onSelect = vi.fn();
  render(
    <CampaignRibbon
      campaigns={campaigns}
      selectedCampaignId="CMP005"
      loading={false}
      error={null}
      onSelect={onSelect}
    />,
  );
  const button = screen.getByRole("button", { name: "Valentine's Favorites" });
  expect(button.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(button);
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("CMP005");
});
it("loads campaigns and atomically commits products and presentation; subsequent prompt has no selection", async () => {
  let resolve!: (r: IntentResult) => void;
  const api = {
    listCampaigns: vi.fn().mockResolvedValue({ campaigns }),
    getCampaignProducts: vi.fn(
      (_id: string, requestId?: string) =>
        new Promise<IntentResult>(
          (r) => (resolve = (value) => r({ ...value, requestId: requestId! })),
        ),
    ),
    prompt: vi
      .fn()
      .mockImplementation(async (_prompt: string, requestId?: string) => ({
        ...result,
        requestId: requestId!,
        presentation: { selectedCampaignId: null },
      })),
  };
  const { result: hook } = renderHook(() => useCampaignExperience(api));
  await waitFor(() => expect(hook.current.campaignLoading).toBe(false));
  let pending!: Promise<void>;
  act(() => {
    pending = hook.current.selectCampaign("CMP005");
  });
  expect(hook.current.selectedCampaignId).toBeNull();
  expect(hook.current.result).toBeNull();
  expect(api.prompt).not.toHaveBeenCalled();
  await act(async () => {
    resolve(result);
    await pending;
  });
  expect(hook.current.selectedCampaignId).toBe("CMP005");
  expect(hook.current.result?.dataset).toEqual([{ productId: "P001" }]);
  await act(() => hook.current.submitPrompt("show everything"));
  expect(api.prompt).toHaveBeenCalledExactlyOnceWith(
    "show everything",
    expect.any(String),
  );
  expect(hook.current.selectedCampaignId).toBeNull();
});
it("keeps last successful view on failure and ignores stale responses", async () => {
  let first!: (r: IntentResult) => void;
  const api = {
    listCampaigns: vi.fn().mockResolvedValue({ campaigns }),
    getCampaignProducts: vi
      .fn()
      .mockImplementationOnce(
        (_id: string, requestId?: string) =>
          new Promise<IntentResult>(
            (r) => (first = (value) => r({ ...value, requestId: requestId! })),
          ),
      )
      .mockImplementation(async (_id: string, requestId?: string) => ({
        ...result,
        requestId: requestId!,
        presentation: { selectedCampaignId: "CMP001" },
      })),
    prompt: vi.fn().mockRejectedValue(new Error("Failed")),
  };
  const { result: h } = renderHook(() => useCampaignExperience(api));
  await waitFor(() => expect(h.current.campaignLoading).toBe(false));
  let old!: Promise<void>;
  act(() => {
    old = h.current.selectCampaign("CMP005");
  });
  await act(() => h.current.selectCampaign("CMP001"));
  await act(async () => {
    first(result);
    await old;
  });
  expect(h.current.selectedCampaignId).toBe("CMP001");
  await act(() => h.current.submitPrompt("hello"));
  expect(h.current.error).toBe("Failed");
  expect(h.current.selectedCampaignId).toBe("CMP001");
});
it("wire requests contain independent prompt and campaign payloads", async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(async (_url: string, init: RequestInit) => ({
      ok: true,
      json: async () => ({
        ...result,
        requestId: (init.headers as Record<string, string>)["X-Request-ID"],
      }),
    }));
  vi.stubGlobal("fetch", fetcher);
  await campaignApi.getCampaignProducts("CMP005", "wire-ribbon");
  await campaignApi.prompt("under $75", "wire-prompt");
  expect(fetcher.mock.calls[0][1].headers["X-Request-ID"]).toBe("wire-ribbon");
  expect(fetcher.mock.calls[1][1].headers["X-Request-ID"]).toBe("wire-prompt");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    campaignId: "CMP005",
  });
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
    prompt: "under $75",
  });
});

it("rejects a response belonging to another interaction without changing the view", async () => {
  const api = {
    listCampaigns: vi.fn().mockResolvedValue({ campaigns }),
    getCampaignProducts: vi
      .fn()
      .mockResolvedValue({ ...result, requestId: "wrong" }),
    prompt: vi.fn(),
  };
  const { result: h } = renderHook(() => useCampaignExperience(api));
  await waitFor(() => expect(h.current.campaignLoading).toBe(false));
  await act(() => h.current.selectCampaign("CMP005"));
  expect(h.current.error).toContain("correlation mismatch");
  expect(h.current.result).toBeNull();
  expect(h.current.selectedCampaignId).toBeNull();
});
it("checks API response correlation for discovery and intent", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ requestId: "wrong" }),
      }),
  );
  await expect(campaignApi.listCampaigns("discovery-1")).rejects.toThrow(
    "correlation mismatch",
  );
  await expect(campaignApi.prompt("hello", "prompt-1")).rejects.toThrow(
    "correlation mismatch",
  );
});
