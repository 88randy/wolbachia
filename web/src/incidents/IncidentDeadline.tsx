import { useTranslation } from "react-i18next";
import { RelativeTime } from "../analytics/RelativeTime";
import { useMe } from "../session/use-me";
export function IncidentDeadline({ deadline }: { deadline: string | null }) {
  const { t } = useTranslation();
  const zone = useMe().organization?.timezone ?? "UTC";
  return deadline ? (
    <RelativeTime dateTime={deadline} timeZone={zone} />
  ) : (
    <span>{t("incidents.workspace.noDeadline")}</span>
  );
}
