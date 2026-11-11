import { Bike, CircleCheck, Gauge, Map as MapIcon, TriangleAlert } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { KIT_ICON_STROKE, kitShadow } from "../../ui/kit-styles.ts";
import { isMapReady } from "./domain.ts";
import type { ShiftSnapshot } from "./service.ts";

function Row({ icon: IconComponent, text }: { readonly icon: LucideIcon; readonly text: string }) {
  const { theme } = useTheme();
  return (
    <View className="flex-row items-center gap-3">
      <IconComponent color={theme.color.action} size={24} strokeWidth={KIT_ICON_STROKE} />
      <AppText variant="bodyStrong" className="flex-1">
        {text}
      </AppText>
    </View>
  );
}

function mapSummaryKey(state: ShiftSnapshot) {
  if (isMapReady(state.map)) return "field.open.mapReady";
  if (state.map?.status === "preparing") return "field.open.mapPreparing";
  if (!state.requiresOfflineMap) return "field.open.mapOnline";
  return state.map?.status === "failed" ? "field.open.mapFailed" : "field.open.mapPreparing";
}

/** What the courier is about to leave with: moto, kilometers, safety result and map. */
export function DepartureSummary({ state }: { readonly state: ShiftSnapshot }) {
  const t = useT();
  const draft = state.draft;
  if (!draft) return null;
  const faults = draft.checks.filter((check) => check.result !== "ok").length;
  const mapKey = mapSummaryKey(state);
  return (
    <View className="gap-4 rounded-card border border-line bg-surface p-4" style={kitShadow.card}>
      <Row icon={Bike} text={t("field.open.summaryMotorcycle", { code: draft.motorcycle_code })} />
      <Row icon={Gauge} text={t("field.open.summaryOdometer", { km: draft.odometer_km })} />
      <Row
        icon={faults === 0 ? CircleCheck : TriangleAlert}
        text={
          faults === 0
            ? t("field.open.summaryAllGood")
            : t("field.open.summaryFaults", { count: faults })
        }
      />
      <Row icon={MapIcon} text={t(mapKey)} />
    </View>
  );
}
