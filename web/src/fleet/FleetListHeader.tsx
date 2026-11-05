import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
import page from "../styles/page.module.css";
import { MOTORCYCLE_MANAGE } from "./permissions";
import styles from "./fleet.module.css";
export function FleetListHeader({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  const can = useCan();
  return (
    <div className={styles.heading}>
      <h1 className={page.title}>{t("fleet.page.title")}</h1>
      {can(MOTORCYCLE_MANAGE) && (
        <button
          type="button"
          className={classNames(buttons.button, buttons.primary)}
          onClick={onAdd}
        >
          {t("fleet.create.title")}
        </button>
      )}
    </div>
  );
}
