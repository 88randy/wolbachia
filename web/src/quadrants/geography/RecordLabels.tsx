import { messages } from "@wolbachia/i18n";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
/** Resource-local terminology: retirement is not a void, and the default section is history. */
export function RecordLabels({ children }: { children: ReactNode }) {
  const { i18n, t } = useTranslation();
  const local = useMemo(() => {
    const language = i18n.language;
    const fork = i18n.cloneInstance({ forkResourceStore: true, lng: language });
    fork.addResources(language, "translation", {
      "table.filters.all": t("geography.history.default"),
      "table.voided.badge": t("geography.status.retired"),
      "table.voided.author":
        messages[i18n.language === "en" ? "en" : "es-MX"]["geography.retire.author"],
    });
    return fork;
  }, [i18n, t]);
  return <I18nextProvider i18n={local}>{children}</I18nextProvider>;
}
