import { useTranslation } from "react-i18next";
import { Card } from "../src/ui/Card";
import { PREVIEW_COLOR_ROLES } from "./preview-token-roles";
import { PreviewTypeScale } from "./PreviewTypeScale";
import { PreviewScroll } from "./PreviewScroll";
import styles from "./PreviewComponents.module.css";
export function PreviewTokens() {
  const { t } = useTranslation();
  return (
    <div className={styles.stack}>
      <Card title={t("refresh.preview.tokens")}>
        <div className={styles.swatches}>
          {PREVIEW_COLOR_ROLES.map((role) => (
            <div key={role.cssName} className={styles.swatch}>
              <div
                aria-hidden="true"
                className={styles.swatchColor}
                ref={(element) => {
                  element?.style.setProperty("--preview-swatch", `var(${role.cssName})`);
                }}
              />
              <span className={styles.swatchName}>{role.name}</span>
            </div>
          ))}
        </div>
      </Card>
      <PreviewTypeScale />
      <PreviewScroll />
    </div>
  );
}
