import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { SectionTitle } from "../../ui/SectionTitle.tsx";
import { IncidentHistoryRow } from "./IncidentHistoryRow.tsx";
import type { M12Model } from "./use-m-12.ts";

/** Only server-readable own cases are shown; a retained page is never a delivery/read receipt. */
export function IncidentHistory({ model }: { readonly model: M12Model }) {
  const t = useT();
  const incidents = model.state?.incidents ?? [];
  if (incidents.length === 0) {
    if (!model.state?.canRead) return null;
    return <AppText tone="secondary">{t("mobile.incidents.noIncidents")}</AppText>;
  }
  return (
    <>
      <SectionTitle title={t("mobile.incidents.mine")} />
      <AppText variant="caption" tone="secondary">
        {t("mobile.incidents.repliesUnavailable")}
      </AppText>
      {incidents.map((incident) => (
        <IncidentHistoryRow key={incident.id} incident={incident} />
      ))}
    </>
  );
}
