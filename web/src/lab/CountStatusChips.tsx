import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useOrganizationTimeZone } from "../format/use-time-zone";
import { useCan } from "../session/use-can";
import { buttonVariants } from "../ui/button-variants";
import { StatusPill } from "../ui/StatusPill";
import { isToday, recentCountsOptions } from "./count-side-query";
import { pendingCountOptions } from "./lab-lists";
import type { LabScope } from "./lab-query";

/** Header chips: counted today (green), what is left (amber) and the history link. */
export function CountStatusChips({ scope }: { scope: LabScope }) {
  const { t } = useTranslation();
  const canRead = useCan()("egg_count.read");
  const timeZone = useOrganizationTimeZone();
  const recent = useQuery(recentCountsOptions(scope));
  const left = useQuery(pendingCountOptions(scope, "count"));
  const today = recent.data?.results.filter(
    (row) => !row.voided && isToday(row.created_at, timeZone),
  );
  return (
    <>
      {today && (
        <StatusPill tone="success">
          {t("lab.count.countedToday", { count: today.length })}
        </StatusPill>
      )}
      {left.data !== undefined && (
        <StatusPill tone="warning">{t("lab.count.remaining", { count: left.data })}</StatusPill>
      )}
      {canRead && (
        <Link to="/lab/count-history" className={buttonVariants({ variant: "secondary" })}>
          <History aria-hidden="true" className="size-4" />
          {t("lab.history.title")}
        </Link>
      )}
    </>
  );
}
