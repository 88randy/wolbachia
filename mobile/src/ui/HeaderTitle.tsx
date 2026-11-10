import { View } from "react-native";

import { useT } from "../i18n/I18nProvider.tsx";
import { AppText } from "./AppText.tsx";

interface HeaderTitleProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly step?: { readonly current: number; readonly total: number };
}

/** Title block of the AppHeader: optional small line, "Paso X de N" and the title. */
export function HeaderTitle({ title, subtitle, step }: HeaderTitleProps) {
  const t = useT();
  return (
    <View className="flex-1 gap-0.5">
      {subtitle ? (
        <AppText variant="caption" tone="secondary">
          {subtitle}
        </AppText>
      ) : null}
      {step ? (
        <AppText variant="captionStrong" tone="secondary">
          {t("courier.header.step", { current: step.current, total: step.total })}
        </AppText>
      ) : null}
      <AppText variant="h2" accessibilityRole="header">
        {title}
      </AppText>
    </View>
  );
}
