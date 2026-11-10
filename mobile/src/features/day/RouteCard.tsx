import { ArrowRight, Navigation } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Badge } from "../../ui/Badge.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { kitShadow } from "../../ui/kit-styles.ts";
import { hasCoordinates } from "./assignment-parser.ts";
import type { DayTask } from "./domain.ts";
import { ACTION_KEYS, markerState } from "./presentation.ts";

interface Props {
  readonly row: DayTask;
  readonly isActing: boolean;
  readonly navigationFailed: boolean;
  readonly onDirections: () => void;
  readonly onStart: () => void;
}

/** One point of the route: what to do, its state, how far it is, and the two things you can do. */
export function RouteCard({ row, isActing, navigationFailed, onDirections, onStart }: Props) {
  const t = useT();
  const state = markerState(row);
  const isDone = row.completion === "complete";
  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4" style={kitShadow.card}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <AppText variant="h2">{t("field.day.point", { code: row.task.point_code })}</AppText>
          <AppText variant="bodyStrong" tone="secondary">
            {t(ACTION_KEYS[row.task.action])}
          </AppText>
          {row.distanceM === null ? null : (
            <AppText tone="secondary">
              {t("field.day.distance", { meters: Math.round(row.distanceM) })}
            </AppText>
          )}
        </View>
        <Badge tone={state.tone} icon={state.icon} label={t(state.key)} />
      </View>
      {row.task.risk === "high" ? (
        <Badge tone="critical" icon="alert" label={t("mobile.day.highRisk")} />
      ) : null}
      {row.task.reference ? (
        <AppText tone="secondary">{row.task.reference}</AppText>
      ) : null}
      {isDone ? null : (
        <View className="gap-3">
          <SecondaryButton
            icon={Navigation}
            label={t("mobile.day.navigate")}
            disabled={isActing || !hasCoordinates(row.task)}
            onPress={onDirections}
          />
          <SecondaryButton icon={ArrowRight} label={t("field.day.start")} onPress={onStart} />
        </View>
      )}
      {navigationFailed ? (
        <InfoNotice tone="warning" message={t("field.day.noMapsApp")} />
      ) : null}
    </View>
  );
}
