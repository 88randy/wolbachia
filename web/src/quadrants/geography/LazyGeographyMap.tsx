import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { MapBoundary } from "./MapBoundary";
import type { MapProps } from "./map-types";
const GeographyMap = lazy(() => import("./GeographyMap"));
export function LazyGeographyMap(props: MapProps) {
  const { t } = useTranslation();
  return (
    <MapBoundary>
      <Suspense fallback={<p role="status">{t("states.loading.label")}</p>}>
        <GeographyMap {...props} />
      </Suspense>
    </MapBoundary>
  );
}
