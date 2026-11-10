import { View } from "react-native";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { kitShadow } from "../../ui/kit-styles.ts";
import { catalogLabel } from "./labels.ts";
import type { Draft } from "./types.ts";

function captureTime(draft: Draft, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: draft.assignment?.organization?.timezone,
    }).format(new Date(draft.deviceTime));
  } catch (error) {
    if (error instanceof RangeError) return draft.deviceTime;
    throw error;
  }
}

/** "Revisa antes de guardar": the answers in plain words, no codes. */
export function CaptureSummary({ draft }: { readonly draft: Draft }) {
  const t = useT();
  const locale = useLocale();
  const finding = draft.catalog?.findings.find((item) => item.code === draft.finding);
  const yesNo = (value: boolean | null) => t(value ? "courier.choice.yes" : "courier.choice.no");
  return (
    <View className="gap-2 rounded-card border border-line bg-surface p-4" style={kitShadow.card}>
      <AppText variant="h2">{t("field.day.point", { code: draft.point?.code ?? "" })}</AppText>
      <AppText tone="secondary">{captureTime(draft, locale)}</AppText>
      <AppText variant="bodyStrong">
        {t(draft.mode === "place" ? "field.capture.summaryPlace" : "field.capture.summaryCheck")}
      </AppText>
      {finding ? <AppText>{catalogLabel(finding, locale)}</AppText> : null}
      {draft.mode === "check" && draft.paddlePresent !== null ? (
        <AppText>
          {t("field.capture.summaryPaddle", { answer: yesNo(draft.paddlePresent) })}
        </AppText>
      ) : null}
      {draft.paddlePresent && draft.hasEggs !== null ? (
        <AppText>{t("field.capture.summaryEggs", { answer: yesNo(draft.hasEggs) })}</AppText>
      ) : null}
      {draft.bagCode ? <AppText>{t("field.capture.bagReady")}</AppText> : null}
      {draft.evidence.length > 0 ? (
        <AppText>{t("field.lifecycle.photosCount", { count: draft.evidence.length })}</AppText>
      ) : null}
    </View>
  );
}
