import type { ReactNode } from "react";
import { classNames } from "../styles/class-names";
import { ToneIcon } from "./ToneIcon";
import type { Tone } from "./tone";
import styles from "./ui.module.css";
export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={classNames(styles.pill, styles[tone])}>
      <ToneIcon tone={tone} />
      {children}
    </span>
  );
}
