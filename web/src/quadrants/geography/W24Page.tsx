import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { FilterBar } from "../../data-table/FilterBar";
import { RECORD_TABLE } from "./geography-table";
import type { GeographyScope } from "./use-w-15";
import { QuadrantHistory } from "./QuadrantHistory";
import { BlocksTable } from "./BlocksTable";
import { PointsTable } from "./PointsTable";
import { BlockTools } from "./BlockTools";
import styles from "./geography.module.css";
interface Props {
  scope: GeographyScope;
  quadrant: Schemas["Quadrant"];
}
export function W24Page({ scope, quadrant }: Props) {
  const { t } = useTranslation();
  const base = useTableUrlState(RECORD_TABLE);
  const controller = { ...base, ignored: base.ignored.filter((key) => key !== "history_page") };
  const view = controller.state.filters["view"] ?? "history";
  return (
    <section className={styles.card} aria-label={t("geography.points.title")}>
      <FilterBar controller={controller} />
      {view === "history" && (
        <QuadrantHistory scope={scope} quadrant={quadrant.id} controller={controller} />
      )}
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
