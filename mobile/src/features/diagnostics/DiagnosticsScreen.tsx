import { useSyncExternalStore } from "react";

import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { diagnostics } from "./diagnostic-log.ts";

/** Ayuda → Información técnica: the last failed-save lines kept on the phone. No personal data. */
export function DiagnosticsScreen() {
  const t = useT();
  const entries = useSyncExternalStore(diagnostics.subscribe, diagnostics.entries);
  return (
    <ScreenScaffold header={<AppHeader title={t("courier.diagnostics.title")} />}>
      <AppText tone="secondary">{t("courier.diagnostics.hint")}</AppText>
      {entries.length === 0 ? <AppText>{t("courier.diagnostics.empty")}</AppText> : null}
      {[...entries].reverse().map((entry) => (
        <AppText key={`${entry.at}${entry.line}`} variant="caption" selectable>
          {`${entry.at} ${entry.line}`}
        </AppText>
      ))}
    </ScreenScaffold>
  );
}
