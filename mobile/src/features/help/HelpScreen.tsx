import {
  GraduationCap,
  Users,
  History,
  Inbox,
  Settings,
  Siren,
  TriangleAlert,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { MessageKey } from "@wolbachia/i18n";

import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import type { Route } from "../../navigation/routes.ts";
import { ActionGrid } from "../../ui/ActionGrid.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";

const TILES: readonly { icon: LucideIcon; labelKey: MessageKey; route: Route }[] = [
  { icon: TriangleAlert, labelKey: "courier.help.incident", route: { name: "incidents" } },
  {
    icon: Users,
    labelKey: "courier.flow.community.tile",
    route: { name: "communityActivity" },
  },
  { icon: Inbox, labelKey: "courier.help.inbox", route: { name: "inbox" } },
  { icon: GraduationCap, labelKey: "courier.help.training", route: { name: "training" } },
  { icon: History, labelKey: "courier.help.history", route: { name: "history" } },
  { icon: Settings, labelKey: "courier.help.settings", route: { name: "settings" } },
];

/** "Ayuda" tab: emergency first, then problems, uploads, trainings, history and settings. */
export function HelpScreen() {
  const t = useT();
  const { push } = useNavigation();
  const items = TILES.map(({ icon, labelKey, route }) => ({
    key: labelKey,
    icon,
    label: t(labelKey),
    onPress: () => {
      push(route);
    },
  }));
  return (
    <ScreenScaffold header={<AppHeader title={t("courier.help.title")} onBack={null} />} tab="help">
      <AppText variant="bodyStrong" tone="secondary">
        {t("courier.help.subtitle")}
      </AppText>
      <PrimaryButton
        tone="danger"
        icon={Siren}
        label={t("courier.help.emergency")}
        accessibilityHint={t("courier.help.emergencyHint")}
        onPress={() => {
          push({ name: "emergency" });
        }}
      />
      <ActionGrid items={items} />
    </ScreenScaffold>
  );
}
