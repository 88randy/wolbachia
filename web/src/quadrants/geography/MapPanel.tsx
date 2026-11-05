import { useTranslation } from "react-i18next";
import type { MapProps } from "./map-types";
import { DrawingControls } from "./DrawingControls";
import { LazyGeographyMap } from "./LazyGeographyMap";
import { useMapPanel } from "./use-map-panel";
import styles from "./geography.module.css";
interface Props extends Omit<MapProps, "onVertex"> {
  text?: string;
  onText?: (text: string) => void;
}
export function MapPanel({ text, onText, ...layers }: Props) {
  const { t } = useTranslation();
  const map = useMapPanel(text, onText);
  const drawing = { text: text ?? "", isDrawing: map.isDrawing, onDrawing: map.setDrawing };
  return (
    <section className={styles.mapPanel} aria-label={t("geography.map.label")}>
      <button type="button" aria-expanded={map.isOpen} onClick={map.toggle}>
        {t(map.isOpen ? "geography.map.close" : "geography.map.open")}
      </button>
      <p>{t("geography.map.hint")}</p>
      {onText && <DrawingControls {...drawing} onText={onText} />}
      {map.isOpen && <LazyGeographyMap {...layers} onVertex={map.onVertex} />}
    </section>
  );
}
