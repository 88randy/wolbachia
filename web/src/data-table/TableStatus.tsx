import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import utilities from "../styles/utilities.module.css";
import styles from "./data-table.module.css";
import { rangeOf } from "./table-state";
import type { Paging } from "./table-types";

interface TableStatusProps {
  paging: Paging | undefined;
  rowCount: number;
  isFetching: boolean;
  /** Already translated: "Sorted by Version, ascending", or `null` when not sorted. */
  sortText: string | null;
}

/**
 * Two polite live regions: the result count (visible; it also says "loading" while a request is
 * in flight) and the sort state (screen readers only). They are rendered all the time so a
 * change of their text is announced, which is what makes sorting and paging audible.
 */
export function TableStatus({ paging, rowCount, isFetching, sortText }: TableStatusProps) {
  const { t } = useTranslation();
  return (
    <>
      <p className={styles.count} role="status">
        {isFetching ? t("table.status.loading") : countText(paging, rowCount, t)}
      </p>
      <p className={utilities.srOnly} role="status">
        {sortText}
      </p>
    </>
  );
}

function countText(paging: Paging | undefined, rowCount: number, t: TFunction): string {
  if (paging === undefined) return "";
  if (paging.mode === "cursor") return t("table.status.rangeCursor", { count: rowCount });
  const { from, to } = rangeOf(paging.page, paging.pageSize, rowCount);
  return t("table.status.range", { from, to, total: paging.count });
}
