import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";

/** Replace: what to tell the courier on the last page. The new trap keeps the same number. */
export function P15Screen() {
  const t = useT();
  return <InfoNotice tone="info" message={t("field.lifecycle.replaceNote")} />;
}
