import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { FilterOption, TableController } from "./table-types";
import styles from "./filter-bar.module.css";
/** All public ordering fields remain available even when their column is outside the viewport. */
export function SortSelect({ controller }: { controller: TableController }) {
  const id = useId();
  const { t } = useTranslation();
  const { sort, isSortExplicit } = controller.state;
  const value = isSortExplicit && sort ? `${sort.direction === "desc" ? "-" : ""}${sort.id}` : "";
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {t("refresh.filters.ordering")}
      </label>
      <select
        id={id}
        value={value}
        className={styles.control}
        onChange={(event) => {
          controller.setOrdering(event.target.value || undefined);
        }}
      >
        <option value="">{t("refresh.filters.defaultOrder")}</option>
        <OrderingOptions options={controller.config.sortOptions ?? []} />
      </select>
    </div>
  );
}

function OrderingOptions({ options }: { options: readonly FilterOption[] }) {
  const { t } = useTranslation();
  return options.flatMap((option) =>
    [false, true].map((isDescending) => (
      <option
        key={`${isDescending ? "-" : ""}${option.value}`}
        value={`${isDescending ? "-" : ""}${option.value}`}
      >
        {t(option.labelKey)} ·{" "}
        {t(isDescending ? "refresh.filters.descending" : "refresh.filters.ascending")}
      </option>
    )),
  );
}
