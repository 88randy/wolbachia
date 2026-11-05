import { Save, Search, Download, Ellipsis, Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../src/ui/Button";
import { Card } from "../src/ui/Card";
import { Tooltip } from "../src/ui/Tooltip";
import styles from "./PreviewComponents.module.css";
const VARIANTS = [
  { variant: "primary", key: "primary", icon: Save },
  { variant: "secondary", key: "secondary", icon: Search },
  { variant: "tertiary", key: "tertiary", icon: Download },
  { variant: "ghost", key: "ghost", icon: Ellipsis },
] as const;
const SIZES = ["sm", "md", "lg", "xl"] as const;
export function PreviewButtons() {
  const { t } = useTranslation();
  return (
    <Card title={t("refresh.preview.buttons")}>
      <div className={styles.stack}>
        {VARIANTS.map(({ variant, key, icon: Icon }) => (
          <div key={variant} className={styles.buttonRow}>
            <span className={styles.variantLabel}>{variant}</span>
            <div className={styles.buttonSamples}>
              {SIZES.map((size) => (
                <Button
                  key={size}
                  variant={variant}
                  size={size}
                  leadingIcon={<Icon aria-hidden="true" strokeWidth={1.5} />}
                >
                  {t(`refresh.preview.${key}`)}
                </Button>
              ))}
            </div>
          </div>
        ))}
        <div className={styles.row}>
          <Button loading aria-label={t("refresh.preview.loading")}>
            {t("refresh.preview.primary")}
          </Button>
          <Tooltip content={t("refresh.preview.notice")}>
            <Button variant="ghost" aria-label={t("shell.topBar.notifications")}>
              <Bell aria-hidden="true" strokeWidth={1.5} />
            </Button>
          </Tooltip>
        </div>
        <div className={styles.stack}>
          <Button disabled aria-describedby="preview-disabled-reason">
            {t("refresh.preview.disabled")}
          </Button>
          <p id="preview-disabled-reason" className={styles.label}>
            {t("refresh.preview.disabledReason")}
          </p>
        </div>
      </div>
    </Card>
  );
}
