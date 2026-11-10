import { useId } from "react";
import { useTranslation } from "react-i18next";
import { SelectMenu } from "../ui/SelectMenu";
import type { TableController } from "./table-types";
import type { TFunction } from "i18next";
import styles from "./filter-bar.module.css";
/** All public ordering fields remain available even when their column is outside the viewport. */
export function SortSelect({ controller }: { controller: TableController }) {
  const id = useId();
  const { t } = useTranslation();
  const { sort, isSortExplicit } = controller.state;
  const value = isSortExplicit && sort ? `${sort.direction === "desc" ? "-" : ""}${sort.id}` : "";
  const options = orderingOptions(controller, t);
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {t("refresh.filters.ordering")}
      </label>
      <SelectMenu
        id={id}
        className="min-w-48"
        value={value}
        options={options}
        onValueChange={(next) => {
          controller.setOrdering(next || undefined);
        }}
      />
    </div>
  );
}

function orderingOptions(controller: TableController, t: TFunction) {
  return [
    { value: "", label: t("refresh.filters.defaultOrder") },
    ...(controller.config.sortOptions ?? []).flatMap((option) =>
      [false, true].map((isDescending) => ({
        value: `${isDescending ? "-" : ""}${option.value}`,
        label: `${t(option.labelKey)} · ${t(
          isDescending ? "refresh.filters.descending" : "refresh.filters.ascending",
        )}`,
      })),
    ),
  ];
}
