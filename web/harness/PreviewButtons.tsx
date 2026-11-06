import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../src/ui/Button";
import { Card } from "../src/ui/Card";
import { Tooltip } from "../src/ui/Tooltip";
import { PreviewButtonMatrix } from "./PreviewButtonMatrix";
import { BUTTON_VARIANTS } from "./preview-button-options";
import styles from "./PreviewComponents.module.css";
export function PreviewButtons() {
  const { t } = useTranslation();
  return (
    <Card title={t("refresh.preview.buttons")} className={styles.catalogWide}>
      <div className={styles.stack}>
        {BUTTON_VARIANTS.map((entry) => (
          <PreviewButtonMatrix key={entry.variant} entry={entry} />
        ))}
        <p id="preview-disabled-reason" className={styles.label}>
          {t("refresh.buttons.disabledHint")}
        </p>
        <Tooltip content={t("refresh.preview.notice")}>
          <Button variant="ghost" aria-label={t("shell.topBar.notifications")}>
            <Bell aria-hidden="true" strokeWidth={1.5} />
          </Button>
        </Tooltip>
      </div>
    </Card>
  );
}
