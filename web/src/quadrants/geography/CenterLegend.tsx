import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { centerPattern } from "./map-features";
import styles from "./geography.module.css";
export function CenterLegend({ quadrants }: { quadrants: readonly Schemas["Quadrant"][] }) {
  const { t } = useTranslation();
  const centers = [...new Set(quadrants.map((quadrant) => quadrant.center))];
  return (
    <div aria-label={t("geography.field.center")}>
      {centers.map((center) => (
        <p key={center}>
          <span className={styles[centerPattern(center)]} aria-hidden="true" />
          {center}
        </p>
      ))}
    </div>
  );
}
