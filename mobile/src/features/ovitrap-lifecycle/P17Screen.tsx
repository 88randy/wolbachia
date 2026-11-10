import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";

/** Retire: say clearly what happens, because it cannot be undone from the phone. */
export function P17Screen() {
  const t = useT();
  return <InfoNotice tone="warning" message={t("field.lifecycle.removeConsequence")} />;
}
