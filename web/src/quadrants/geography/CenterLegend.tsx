import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { centerPattern } from "./map-features";
import styles from "./geography.module.css";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../../api/ApiClientProvider";
import { centersOptions } from "../../centers/centers-query";
import { useSessionIdentity } from "../../session/use-session-identity";
export function CenterLegend({ quadrants }: { quadrants: readonly Schemas["Quadrant"][] }) {
  const { t } = useTranslation();
  const centers = [...new Set(quadrants.map((quadrant) => quadrant.center))];
  const names = useQuery(centersOptions(useApiClient(), useSessionIdentity()));
  const nameOf = (id: string) => names.data?.find((item) => item.id === id)?.name ?? "—";
  return (
    <div aria-label={t("geography.field.center")}>
      {centers.map((center) => (
        <p key={center}>
          <span className={styles[centerPattern(center)]} aria-hidden="true" />
          {nameOf(center)}
        </p>
      ))}
    </div>
  );
}
