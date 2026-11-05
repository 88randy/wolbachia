import styles from "./analytics.module.css";
interface ChartRangeInputProps {
  label: string;
  description: string;
  index: number;
  maximum: number;
  onSelect: (index: number | null) => void;
}
/** Focus reserves the same inspector space already present beside the plot. */
export function ChartRangeInput(props: ChartRangeInputProps) {
  return (
    <input
      className={styles.chartSlider}
      type="range"
      min={0}
      max={props.maximum}
      value={props.index}
      aria-label={props.label}
      aria-valuetext={props.description}
      onFocus={() => {
        props.onSelect(props.index);
      }}
      onBlur={() => {
        props.onSelect(null);
      }}
      onChange={(event) => {
        props.onSelect(Number(event.target.value));
      }}
    />
  );
}
