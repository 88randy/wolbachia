import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import styles from "./geography.module.css";
interface Props {
  warnings: Schemas["SpacingWarning"][];
  points: readonly Pick<Schemas["SamplingPoint"], "id" | "code">[];
}
export function SpacingWarnings({ warnings, points }: Props) {
  const { t } = useTranslation();
  if (!warnings.length) return null;
  return (
    <aside className={styles.warning} aria-label={t("geography.points.spacing")}>
      <div role="status">
        <h3>{t("geography.points.spacing")}</h3>
        {warnings.map((warning, index) => (
          <p key={index}>
            {points.find((point) => point.id === warning.point)?.code ?? warning.point}
            {" · "}
            {t("geography.points.distance")}
            {": "}
            {warning.distance_m}
            {" · "}
            {t("geography.points.minimum")}
            {": "}
            {warning.minimum_m}
          </p>
        ))}
      </div>
    </aside>
  );
}
