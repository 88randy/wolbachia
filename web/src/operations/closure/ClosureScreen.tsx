import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { ClosureDetails } from "./ClosureDetails";
import type { ClosureModel } from "./use-closure-model";
import type { Readiness } from "./closure-policy";
import styles from "./closure.module.css";
export function ClosureScreen({ model, readiness }: { model: ClosureModel; readiness: Readiness }) {
  const { t } = useTranslation();
  return (
    <div className={styles.page}>
      <h1>{t("closure.page.title", { code: model.quadrant.code })}</h1>
      <p>{t("closure.page.purpose")}</p>
      <Card
        title={t("closure.readiness.title")}
        actions={
          <Button variant="secondary" loading={model.query.isFetching} onClick={model.refresh}>
            {t("closure.actions.refresh")}
          </Button>
        }
      >
        <ClosureDetails model={model} readiness={readiness} />
      </Card>
    </div>
  );
}
