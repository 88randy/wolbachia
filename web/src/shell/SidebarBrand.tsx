import { useTranslation } from "react-i18next";
import { classNames } from "../styles/class-names";
import utilities from "../styles/utilities.module.css";
import styles from "./Sidebar.module.css";

/** Logo tile and product name. The mark is a placeholder until the client supplies the logo. */
export function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={styles.brand}>
      <span className={styles.mark} aria-hidden="true">
        {t("shell.brand.mark")}
      </span>
      <span className={classNames(collapsed && utilities.srOnly)}>{t("shell.brand.name")}</span>
    </div>
  );
}
