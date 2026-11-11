import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { FilterBar } from "../../data-table/FilterBar";
import { useSearch } from "@tanstack/react-router";
import { RECORD_TABLE, RESOURCE_TABLE } from "./geography-table";
import type { GeographyScope } from "./use-w-15";
import { QuadrantHistory } from "./QuadrantHistory";
import { BlocksTable } from "./BlocksTable";
import { PointsTable } from "./PointsTable";
import { BlockTools } from "./BlockTools";
interface Props {
  scope: GeographyScope;
  quadrant: Schemas["Quadrant"];
}
export function W24Page({ scope, quadrant }: Props) {
  const { t } = useTranslation();
  const selected = useSearch({ strict: false })["view"];
  const config = selected === "blocks" || selected === "points" ? RESOURCE_TABLE : RECORD_TABLE;
  const controller = useTableUrlState(config, { ignoredPrefixes: ["history_"] });
  const view = controller.state.filters["view"] ?? "history";
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label={t("geography.points.title")}>
      <FilterBar controller={controller} />
      {view === "history" && <QuadrantHistory scope={scope} quadrant={quadrant.id} />}
      {view === "blocks" && (
        <BlocksTable scope={scope} quadrant={quadrant.id} controller={controller} />
      )}
      {view === "points" && (
        <PointsTable scope={scope} quadrant={quadrant.id} controller={controller} />
      )}
      <BlockTools scope={scope} quadrant={quadrant} />
    </section>
  );
}
