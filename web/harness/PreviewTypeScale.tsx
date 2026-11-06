import { font, radius, shadow, web } from "@wolbachia/tokens";
import { useTranslation } from "react-i18next";
import { Card } from "../src/ui/Card";
import { kebabCase } from "./preview-token-roles";
import styles from "./PreviewComponents.module.css";
const TYPE_ROLES = Object.keys(web.typography).filter((name) => name.endsWith("FontSize"));
export function PreviewTypeScale() {
  const { t } = useTranslation();
  return (
    <Card title={t("refresh.preview.typography")}>
      <div className={styles.stack}>
        <p className={styles.label}>
          {font.family}
          {" / "}
          {font.mono.family}
        </p>
        {TYPE_ROLES.map((name) => (
          <div key={name}>
            <p className={styles.typeName}>{name}</p>
            <p
              className={styles.typeSample}
              ref={(element) => {
                element?.style.setProperty(
                  "--preview-type-size",
                  `var(--web-type-${kebabCase(name)})`,
                );
              }}
            >
              {t("refresh.preview.typeSample")}
            </p>
          </div>
        ))}
        <p className={styles.mono}>OV-1284 · 05/11/2026 · 1,284</p>
        <div className={styles.row}>
          {Object.keys(radius).map((name) => (
            <div
              key={name}
              className={styles.shape}
              ref={(element) => {
                element?.style.setProperty("--preview-radius", `var(--radius-${kebabCase(name)})`);
              }}
            >
              {name}
            </div>
          ))}
        </div>
        <div className={styles.row}>
          {Object.keys(shadow).map((name) => (
            <div
              key={name}
              className={styles.shape}
              ref={(element) => {
                element?.style.setProperty(
                  "--preview-shadow",
                  `var(--shadow-${name === "level1" ? "level-1" : name})`,
                );
              }}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
