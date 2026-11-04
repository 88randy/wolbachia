import type { ReactNode } from "react";
import styles from "./voided.module.css";

/**
 * Cell content of a voided record: struck through and muted. The strike is only a visual cue (it
 * is not announced), so the same row must also carry a `VoidedBadge`.
 */
export function VoidedText({ children }: { children: ReactNode }) {
  return <s className={styles.text}>{children}</s>;
}
