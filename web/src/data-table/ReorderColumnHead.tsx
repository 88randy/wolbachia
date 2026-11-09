import { useTranslation } from "react-i18next";
import { useReorderItems } from "./reorder-context";
import styles from "./data-table.module.css";
export function ReorderColumnHead() {
  const { t } = useTranslation();
  const items = useReorderItems();
  return items ? (
    <th scope="col" className={styles.head}>
      {t("refresh.reorder.handle")}
    </th>
  ) : null;
}
