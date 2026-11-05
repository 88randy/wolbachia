import { useTranslation } from "react-i18next";
import { undoMapVertex } from "./map-drawing";
import styles from "./geography.module.css";
interface Props {
  text: string;
  onText: (text: string) => void;
  isDrawing: boolean;
  onDrawing: (isDrawing: boolean) => void;
}
export function DrawingControls({ text, onText, isDrawing, onDrawing }: Props) {
  const { t } = useTranslation();
  const draw = () => {
    onDrawing(!isDrawing);
  };
  const undo = () => {
    onText(undoMapVertex(text));
  };
  const close = () => {
    closeRing(text, onText);
  };
  return (
    <div className={styles.actions}>
      <button type="button" aria-pressed={isDrawing} onClick={draw}>
        {t("geography.map.draw")}
      </button>
      <button type="button" onClick={undo}>
        {t("geography.map.undo")}
      </button>
      <button type="button" onClick={close}>
        {t("geography.map.closeRing")}
      </button>
    </div>
  );
}
function closeRing(text: string, onText: (text: string) => void) {
  const rings = text.trim().split(/\n\s*\n/);
  const last = rings.at(-1) ?? "";
  const first = last.split("\n")[0];
  if (first && last.split("\n").at(-1) !== first) onText(text.trim() + "\n" + first);
}
