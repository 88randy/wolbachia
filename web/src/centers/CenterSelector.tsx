import { CenterState } from "./CenterState";
import { useTranslation } from "react-i18next";
import { useCenterSelector } from "./use-center-selector";
import { CenterOptions } from "./CenterOptions";
import styles from "./centers.module.css";
export function CenterSelector() {
  const { t } = useTranslation();
  const selector = useCenterSelector();
  if (!selector.canRead) return null;
  return (
    <div className={styles.picker}>
      <label htmlFor="active-center">{t("orgAdmin.center.filter")}</label>
      <CenterOptions selector={selector} />
      <CenterState selector={selector} />
      {selector.query.isError && (
        <button
          type="button"
          onClick={() => {
            void selector.query.refetch();
          }}
        >
          {t("common.actions.retry")}
        </button>
      )}
      <span className={styles.announcement} role="status">
        {selector.centers.find((center) => center.id === selector.selected)?.name ??
          t("orgAdmin.center.filter")}
      </span>
    </div>
  );
}
