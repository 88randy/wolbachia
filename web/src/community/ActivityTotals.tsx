import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Card } from "../ui/Card";

/** Active activities and attendance observations of every match, not only the visible page. */
export function ActivityTotals({ totals }: { totals: Schemas["CommunityTotals"] | undefined }) {
  const { t, i18n } = useTranslation();
  if (totals === undefined) return null;
  const number = new Intl.NumberFormat(i18n.language);
  const items: [string, string][] = [
    [t("community.totals.activities"), number.format(totals.active_activity_count)],
    [t("community.totals.attendance"), number.format(Number(totals.attendance))],
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <Card key={label} title={label} headingLevel={2}>
          <p className="m-0 text-3xl font-bold text-ink tabular-nums">{value}</p>
        </Card>
      ))}
    </div>
  );
}
