import { useTranslation } from "react-i18next";
import { LEVELS, SWATCH_BACKGROUND } from "./zone-levels";
import type { Level } from "./zone-levels";

/** Swatch of a level: the same color and pattern as on the map. */
export function LevelSwatch({ level }: { level: Level }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-5 flex-none rounded-md border border-line-strong"
      style={{ background: SWATCH_BACKGROUND[level] }}
    />
  );
}

export function PortalMapLegend() {
  const { t } = useTranslation();
  return (
    <ul
      aria-label={t("portal.map.legend")}
      className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-[13px] text-ink"
    >
      {LEVELS.map((level) => (
        <li key={level} className="flex items-center gap-2">
          <LevelSwatch level={level} />
          {t(`portal.map.level.${level}`)}
        </li>
      ))}
    </ul>
  );
}
