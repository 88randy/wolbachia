import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import type { HistoryEntry } from "./domain.ts";

export function HistoryProvenance({ entry }: { readonly entry: HistoryEntry }) {
  const t = useT();
  const locale = useLocale();
  return (
    <>
      {entry.observation ? (
        <AppText>{locale === "en" ? entry.observation.en : entry.observation.es}</AppText>
      ) : null}
      <AppText variant="caption">{t("mobile.history.author")}</AppText>
      <AppText isMonospace>{entry.author ?? t("mobile.history.unavailableValue")}</AppText>
      <AppText variant="caption">{t("mobile.history.reference")}</AppText>
      <AppText isMonospace>{entry.sourceId ?? entry.id}</AppText>
      {entry.reason ? (
        <>
          <AppText variant="caption">{t("mobile.history.reason")}</AppText>
          <AppText>{entry.reason}</AppText>
        </>
      ) : null}
      {entry.voidsId ? (
        <>
          <AppText variant="caption">{t("mobile.history.voids")}</AppText>
          <AppText isMonospace>{entry.voidsId}</AppText>
        </>
      ) : null}
    </>
  );
}
