import { catalogLabel } from "./labels.ts";
import { View } from "react-native";
import { useT, useLocale } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import type { Draft } from "./types.ts";
export function CaptureSummary({ draft }: { readonly draft: Draft }) {
  const t = useT();
  const locale = useLocale();
  const finding = draft.catalog?.findings.find((item) => item.code === draft.finding);
  return (
    <View>
      <AppText variant="h2" accessibilityRole="header">
        {t("mobile.ovitrap.confirm")}
      </AppText>
      <AppText>{draft.point?.code ?? draft.ovitrapId}</AppText>
      {finding ? <AppText>{catalogLabel(finding, locale)}</AppText> : null}
      {draft.paddlePresent && draft.hasEggs !== null ? (
        <AppText>
          {t("mobile.ovitrap.eggs")} {t(draft.hasEggs ? "mobile.ovitrap.yes" : "mobile.ovitrap.no")}
        </AppText>
      ) : null}
      {draft.bagCode ? <AppText>{draft.bagCode}</AppText> : null}
    </View>
  );
}
