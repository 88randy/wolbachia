import { View } from "react-native";

import { useT } from "../i18n/I18nProvider.tsx";
import { AppText } from "./AppText.tsx";

interface HeaderTitleProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly step?: { readonly current: number; readonly total: number };
}

/** Title block of the AppHeader: the title, then one small line with the context and "Paso X de N". */
export function HeaderTitle({ title, subtitle, step }: HeaderTitleProps) {
  const t = useT();
  const stepText = step
    ? t("courier.header.step", { current: step.current, total: step.total })
    : null;
  const detail = [subtitle, stepText].filter(Boolean).join(" · ");
  return (
    <View className="flex-1 gap-0.5">
      <AppText variant="h2" accessibilityRole="header">
        {title}
      </AppText>
      {detail ? (
        <AppText variant="captionStrong" tone="secondary">
          {detail}
        </AppText>
      ) : null}
    </View>
  );
}
