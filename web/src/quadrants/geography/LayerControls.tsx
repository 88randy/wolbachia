import { useTranslation } from "react-i18next";
import { MAP_LAYER_LABELS } from "./use-map-display";
import type { LayerVisibility } from "./use-map-display";

interface Props {
  visible: LayerVisibility;
  onChange: (visible: LayerVisibility) => void;
}
/** One compact row of layer toggles above the map. */
export function LayerControls({ visible, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <fieldset className="m-0 mb-2 flex! min-w-0 flex-row! flex-wrap items-center gap-x-4 gap-y-1 border-0 p-0 text-[13px]">
      <legend className="sr-only">{t("geography.map.label")}</legend>
      {(Object.keys(MAP_LAYER_LABELS) as (keyof LayerVisibility)[]).map((kind) => (
        <label key={kind} className="inline-flex! min-h-6 items-center gap-1.5">
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
