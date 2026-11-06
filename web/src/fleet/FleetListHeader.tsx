import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { MOTORCYCLE_MANAGE } from "./permissions";
import styles from "./fleet.module.css";
export function FleetListHeader({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  const can = useCan();
  const action = can(MOTORCYCLE_MANAGE) ? (
    <Button onClick={onAdd}>{t("fleet.create.title")}</Button>
  ) : undefined;
  return (
    <Card title={t("fleet.page.title")} headingLevel={1} actions={action}>
      <p className={styles.hint}>{t("fleet.page.gaps")}</p>
    </Card>
  );
}
