import { useTranslation } from "react-i18next";
import { RelativeTime } from "../analytics/RelativeTime";
import { useOrganizationTimeZone } from "../format/use-time-zone";
export function IncidentDeadline({ deadline }: { deadline: string | null }) {
  const { t } = useTranslation();
  const zone = useOrganizationTimeZone();
  return deadline ? (
    <RelativeTime dateTime={deadline} timeZone={zone} />
  ) : (
    <span>{t("incidents.workspace.noDeadline")}</span>
  );
}
