import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import type { HistoryEntry } from "./domain.ts";

/** Only what a courier needs: why it was changed or seen by the office. No internal ids. */
export function HistoryProvenance({ entry }: { readonly entry: HistoryEntry }) {
  const t = useT();
  const locale = useLocale();
  return (
    <>
      {entry.observation ? (
        <InfoNotice
          tone="warning"
          message={locale === "en" ? entry.observation.en : entry.observation.es}
        />
      ) : null}
      {entry.reason ? (
        <AppText variant="body">{`${t("mobile.history.reason")}: ${entry.reason}`}</AppText>
      ) : null}
    </>
  );
}
