import type { ReactNode } from "react";
import styles from "./switch.module.css";
interface Props {
  label: ReactNode;
  isOn: boolean;
  disabled?: boolean;
  onChange: (isOn: boolean) => void;
}
/** Native checkbox keyboard behavior with announced switch state and a visible label. */
export function Switch({ label, isOn, disabled, onChange }: Props) {
  return (
    <label className={styles.label}>
      <input
        type="checkbox"
        role="switch"
        checked={isOn}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <span aria-hidden="true" className={styles.track}>
        <span className={styles.thumb} />
      </span>
      <span>{label}</span>
    </label>
  );
}
