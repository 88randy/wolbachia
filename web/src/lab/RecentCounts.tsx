import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/use-language";
import { useCan } from "../session/use-can";
import { Card } from "../ui/Card";
import { bagCodeOptions, recentCountsOptions } from "./count-side-query";
import type { Count, LabScope } from "./lab-query";

const SHOWN = 5;

function RecentList({ scope, rows }: { scope: LabScope; rows: Count[] }) {
  const { language } = useLanguage();
  const codes = useQueries({ queries: rows.map((row) => bagCodeOptions(scope, row.bag_id)) });
  return (
    <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
      {rows.map((row, index) => (
        <li key={row.id} className="flex items-center justify-between gap-3 py-2">
          <span className="min-w-0 truncate text-sm text-ink-2">{codes[index]?.data ?? "-"}</span>
          <span className="text-lg font-bold text-ink tabular-nums">
            {new Intl.NumberFormat(language).format(row.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Side card: the last five counts (bag code and number) and a way to correct one. */
export function RecentCounts({ scope }: { scope: LabScope }) {
  const { t } = useTranslation();
  const canRead = useCan()("egg_count.read");
  const recent = useQuery(recentCountsOptions(scope));
  const rows = (recent.data?.results ?? []).filter((row) => !row.voided).slice(0, SHOWN);
  return (
    <Card title={t("lab.count.recent")}>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-ink-3">{t("lab.count.recentEmpty")}</p>
      ) : (
        <RecentList scope={scope} rows={rows} />
      )}
      {canRead && (
        <Link to="/lab/count-history" className="mt-3 inline-block text-sm font-semibold">
          {t("lab.count.correct")}
        </Link>
      )}
    </Card>
  );
}
