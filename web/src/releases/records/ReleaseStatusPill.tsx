import { useTranslation } from "react-i18next";
import { StatusPill } from "../../ui/StatusPill";
import { releaseStatus } from "./release-status";
import type { Release } from "./releases-query";

/** Accepted or in review: color + icon + text. */
export function ReleaseStatusPill({ row }: { row: Pick<Release, "blocked_by"> }) {
  const { t } = useTranslation();
  const status = releaseStatus(row);
  return <StatusPill tone={status.tone}>{t(status.labelKey)}</StatusPill>;
}
