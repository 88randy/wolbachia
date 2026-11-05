import { useTranslation } from "react-i18next";
import { MAP_LAYER_LABELS } from "./use-map-display";
import type { LayerVisibility } from "./use-map-display";
import styles from "./geography.module.css";
interface Props {
  visible: LayerVisibility;
  onChange: (visible: LayerVisibility) => void;
}
export function LayerControls({ visible, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <fieldset className={styles.actions}>
      <legend>{t("geography.map.label")}</legend>
      {(Object.keys(MAP_LAYER_LABELS) as (keyof LayerVisibility)[]).map((kind) => (
        <label key={kind}>
          <input
            type="checkbox"
            checked={visible[kind]}
            onChange={(event) => {
              onChange({ ...visible, [kind]: event.target.checked });
            }}
          />
          {t(MAP_LAYER_LABELS[kind])}
        </label>
      ))}
    </fieldset>
  );
}
