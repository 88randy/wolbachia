import { useId, type CSSProperties, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import styles from "./annotation-settings.module.css";

interface Props {
  label: string;
  ariaLabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}
const SHIFT_PIXEL_STEP = 10;
const ARROW_DIRECTION: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
};

function changeWithKeyboard(event: KeyboardEvent<HTMLInputElement>, props: Props): void {
  const direction = ARROW_DIRECTION[event.key];
  const step = event.shiftKey ? SHIFT_PIXEL_STEP : (props.step ?? 1);
  let next = props.value;
  if (direction) next += direction * step;
  else if (event.key === "Home") next = props.min;
  else if (event.key === "End") next = props.max;
  else return;
  event.preventDefault();
  props.onChange(Math.max(props.min, Math.min(props.max, next)));
}

function useSliderValue(value: number) {
  const { t, i18n } = useTranslation();
  return new Intl.NumberFormat(i18n.language).format(value) + t("labAnnotation.editor.pixelUnit");
}

export function AnnotationSizeSlider(props: Props) {
  const id = useId();
  const value = useSliderValue(props.value);
  return (
    <div className={styles.slider}>
      <div className={styles.row}>
        <label htmlFor={id}>{props.label}</label>
        <output htmlFor={id}>{value}</output>
      </div>
      <input
        id={id}
        name={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        aria-label={props.ariaLabel}
        aria-valuetext={value}
        style={sliderFill(props)}
        onKeyDown={(event) => {
          changeWithKeyboard(event, props);
        }}
        onChange={(event) => {
          props.onChange(Number(event.target.value));
        }}
      />
    </div>
  );
}

function sliderFill(props: Props): CSSProperties {
  const fill =
    props.max === props.min ? 100 : ((props.value - props.min) / (props.max - props.min)) * 100;
  return { "--range-fill": `${String(fill)}%` } as CSSProperties;
}
