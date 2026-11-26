/* eslint-disable max-lines-per-function -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LevelSwatch } from "./PortalMapLegend";
import type { Zone } from "./portal-data";
import { usePortalFormat } from "./use-portal-format";
import { levelOf, maxReleases } from "./zone-levels";

/** The equivalent of the map: every zone with its releases and its level in words. */
export function PortalZoneTable({ zones }: { zones: readonly Zone[] }) {
  const { t } = useTranslation();
  const format = usePortalFormat();
  const max = maxReleases(zones);
  return (
    <div className="max-h-96 overflow-auto rounded-xl border border-line">
      <Table aria-label={t("portal.map.tableTitle")}>
        <TableHeader className="sticky top-0 bg-surface-muted">
          <TableRow>
            <TableHead scope="col">{t("portal.map.zone")}</TableHead>
            <TableHead scope="col" className="text-right">
              {t("portal.map.releases")}
            </TableHead>
            <TableHead scope="col">{t("portal.map.level")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {zones.map((zone) => {
            const level = levelOf(zone.releases, max);
            return (
              <TableRow key={zone.code}>
                <TableCell>{zone.code}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {format.number(zone.releases)}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <LevelSwatch level={level} />
                    {t(`portal.map.level.${level}`)}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
