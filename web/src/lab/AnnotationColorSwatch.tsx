import { Check } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { ANNOTATION_COLORS, type AnnotationColor } from "./annotation-colors";
import styles from "./annotation-settings.module.css";

interface Props {
  color: AnnotationColor;
  selected: AnnotationColor;
  name: string;
  onChange: (color: AnnotationColor) => void;
}
export function AnnotationColorSwatch({ color, selected, name, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <label
      className={styles.swatch}
      style={{ "--swatch-color": ANNOTATION_COLORS[color] } as CSSProperties}
    >
      <input
        type="radio"
        name={name}
        value={color}
        aria-label={t(`labAnnotation.color.${color}`)}
        checked={selected === color}
        onChange={() => {
          onChange(color);
        }}
      />
      <span aria-hidden="true">
        <Check />
      </span>
    </label>
  );
}
