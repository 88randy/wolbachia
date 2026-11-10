/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useParams } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { OSM_COPYRIGHT, readMapSource } from "../quadrants/geography/map-source";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { InlineNotice } from "../ui/InlineNotice";
import { PortalCutoff } from "./PortalCutoff";
import { PortalMapLegend } from "./PortalMapLegend";
import { PortalError, PortalLoading, PortalMissing } from "./PortalStates";
import { PortalZoneTable } from "./PortalZoneTable";
import { isPortalMissing, usePortalMap } from "./portal-data";

const Canvas = lazy(async () => ({ default: (await import("./PortalMapCanvas")).PortalMapCanvas }));

/** W70: the quadrant polygons with how many releases each has; color and pattern, plus a table. */
export function PortalMap() {
  const { t } = useTranslation();
  const { orgSlug } = useParams({ strict: false });
  const query = usePortalMap(orgSlug ?? "");
  const [failed, setFailed] = useState(false);
  if (query.isPending) return <PortalLoading />;
  if (query.isError)
    return isPortalMissing(query.error) ? (
      <PortalMissing title={t("portal.state.sectionOff")} />
    ) : (
      <PortalError
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  const { zones, cutoff } = query.data;
  const source = readMapSource({
    VITE_MAP_TILES_URL: import.meta.env["VITE_MAP_TILES_URL"],
    VITE_MAP_ATTRIBUTION: import.meta.env["VITE_MAP_ATTRIBUTION"],
  });
  const canDraw = source !== null && !failed && typeof WebGL2RenderingContext !== "undefined";
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <PortalCutoff iso={cutoff} />
        <h1 className="m-0 text-3xl leading-tight font-bold tracking-tight text-navy">
          {t("portal.map.title")}
        </h1>
        <p className="m-0 max-w-2xl text-lg leading-7 text-ink-2">{t("portal.map.lead")}</p>
      </section>
      <Card title={t("portal.map.title")} headingLevel={2}>
        {zones.length === 0 ? (
          <EmptyState kind="noData" message={t("portal.map.empty")} />
        ) : (
          <div className="flex flex-col gap-5">
            <PortalMapLegend />
            {canDraw ? (
              <Suspense fallback={<PortalLoading />}>
                <Canvas
                  zones={zones}
                  source={source}
                  onFailure={() => {
                    setFailed(true);
                  }}
                />
              </Suspense>
            ) : (
              <InlineNotice tone="info">{t("portal.map.unavailable")}</InlineNotice>
            )}
            {canDraw && (
              <a href={OSM_COPYRIGHT} className="text-xs text-ink-2">
                {t("inventory.map.attribution")}
              </a>
            )}
            <PortalZoneTable zones={zones} />
          </div>
        )}
      </Card>
    </div>
  );
}
