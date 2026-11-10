import { LifeBuoy, Map, Sun } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { MessageKey } from "@wolbachia/i18n";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "../i18n/I18nProvider.tsx";
import { useNavigation } from "../navigation/NavigationProvider.tsx";
import type { Route } from "../navigation/routes.ts";
import { useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { KIT_ICON_STROKE } from "./kit-styles.ts";

export type BottomTab = "day" | "map" | "help";

interface TabSpec {
  readonly tab: BottomTab;
  readonly icon: LucideIcon;
  readonly labelKey: MessageKey;
  readonly route: Route;
}

const TABS: readonly TabSpec[] = [
  { tab: "day", icon: Sun, labelKey: "courier.tabs.day", route: { name: "home" } },
  { tab: "map", icon: Map, labelKey: "courier.tabs.map", route: { name: "map" } },
  { tab: "help", icon: LifeBuoy, labelKey: "courier.tabs.help", route: { name: "help" } },
];
const BAR_BOTTOM_GAP = 8;

function Tab({
  spec,
  isActive,
  onPress,
}: {
  readonly spec: TabSpec;
  readonly isActive: boolean;
  readonly onPress: () => void;
}) {
  const t = useT();
  const { theme } = useTheme();
  const color = isActive ? theme.color.action : theme.color.text.secondary;
  const IconComponent = spec.icon;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={t(spec.labelKey)}
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      className="min-h-14 flex-1 items-center justify-center gap-1 rounded-xl active:opacity-70"
    >
      <View className={`rounded-full px-5 py-1 ${isActive ? "bg-tint" : ""}`}>
        <IconComponent color={color} size={24} strokeWidth={KIT_ICON_STROKE} />
      </View>
      <AppText variant={isActive ? "captionStrong" : "caption"} style={{ color }}>
        {t(spec.labelKey)}
      </AppText>
    </Pressable>
  );
}

/**
 * Mi día / Mapa / Ayuda. "Mi día" returns to the home screen; the other tabs open on top of it,
 * so Android Back always comes home.
 */
export function BottomTabBar({ active }: { readonly active: BottomTab }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { push, popToRoot, replace } = useNavigation();
  const open = (spec: TabSpec) => {
    if (spec.tab === active) return;
    if (spec.tab === "day") popToRoot();
    else if (active === "day") push(spec.route);
    else replace(spec.route);
  };
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t("courier.tabs.label")}
      className="flex-row border-t border-line bg-surface px-2 pt-2"
      style={{ paddingBottom: insets.bottom + BAR_BOTTOM_GAP }}
    >
      {TABS.map((spec) => (
        <Tab
          key={spec.tab}
          spec={spec}
          isActive={spec.tab === active}
          onPress={() => {
            open(spec);
          }}
        />
      ))}
    </View>
  );
}
