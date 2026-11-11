import { useTranslation } from "react-i18next";
import { OSM_COPYRIGHT } from "./map-source";

/**
 * Compact OpenStreetMap credit in the map's bottom-right corner (ODbL requires it to stay
 * visible). Render it as a child of `<Map>` so it sits over the map, not in a row below it.
 * React text only: MapLibre's native attribution control stays off (#225).
 */
export function MapAttribution({ source }: { source?: string | undefined }) {
  const { t } = useTranslation();
  return (
    <p className="absolute right-1 bottom-1 z-[2] m-0 max-w-[75%] truncate rounded bg-surface/70 px-1.5 text-[11px] leading-4 text-ink-2">
      <a
        href={OSM_COPYRIGHT}
        target="_blank"
        rel="noreferrer"
        className="text-ink-2 no-underline hover:underline"
      >
        {t("geography.map.attribution")}
      </a>
      {source ? ` · ${source}` : ""}
    </p>
  );
}
