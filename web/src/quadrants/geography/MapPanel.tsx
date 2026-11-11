import { useTranslation } from "react-i18next";
import type { MapProps } from "./map-types";
import { DrawingControls } from "./DrawingControls";
import { LazyGeographyMap } from "./LazyGeographyMap";
import { useMapPanel } from "./use-map-panel";

interface Props extends Omit<MapProps, "onVertex"> {
  text?: string;
  onText?: (text: string) => void;
}
/** The map is always shown: no "open map" box. */
export function MapPanel({ text, onText, ...layers }: Props) {
  const { t } = useTranslation();
  const map = useMapPanel(text, onText);
  const drawing = { text: text ?? "", isDrawing: map.isDrawing, onDrawing: map.setDrawing };
  return (
    <section
      className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card"
      aria-label={t("geography.map.label")}
    >
      {onText && <DrawingControls {...drawing} onText={onText} />}
      <LazyGeographyMap {...layers} onVertex={map.onVertex} />
    </section>
  );
}
