import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { Campaign } from "../services/campaign-api";
type Props = {
  campaigns: Campaign[];
  selectedCampaignId: string | null;
  loading: boolean;
  error: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
};
export function CampaignRibbon({
  campaigns,
  selectedCampaignId,
  loading,
  error,
  disabled,
  onSelect,
}: Props) {
  if (loading)
    return (
      <View>
        <ActivityIndicator />
        <Text>Loading campaigns…</Text>
      </View>
    );
  if (error) return <Text accessibilityRole="alert">{error}</Text>;
  if (!campaigns.length) return <Text>No campaigns available.</Text>;
  return (
    <ScrollView
      horizontal
      style={{ flexGrow: 0 }}
      accessibilityLabel="Marketing campaigns"
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        {campaigns.map((c) => (
          <Pressable
            key={c.campaignId}
            accessibilityRole="button"
            aria-pressed={c.campaignId === selectedCampaignId}
            accessibilityLabel={c.campaignName}
            accessibilityState={{
              selected: c.campaignId === selectedCampaignId,
              disabled: !!disabled,
            }}
            disabled={disabled}
            onPress={() => onSelect(c.campaignId)}
            style={{
              padding: 12,
              borderRadius: 8,
              borderWidth: 2,
              borderColor:
                c.campaignId === selectedCampaignId ? "#735238" : "#ccc",
              backgroundColor:
                c.campaignId === selectedCampaignId ? "#f4e4d6" : "#fff",
            }}
          >
            <Text style={{ color: "#222" }}>{c.campaignName}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
