import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../format/use-format-date-time";
import { LabName } from "./LabName";
import type { Count } from "./lab-query";

export function ConflictCountDetails({ count }: { count: Count | undefined }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  if (!count) return <p>{t("lab.error.conflictMissing")}</p>;
  return (
    <dl>
      <dt>{t("lab.history.author")}</dt>
      <dd>
        <LabName kind="user" id={count.created_by} />
      </dd>
      <dt>{t("lab.history.time")}</dt>
      <dd>
        <time dateTime={count.created_at}>{format(count.created_at)}</time>
      </dd>
    </dl>
  );
}
