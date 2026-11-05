import { useId } from "react";
import type { ReactNode } from "react";
import { classNames } from "../styles/class-names";
import styles from "./ui.module.css";

export interface CardProps {
  title: ReactNode;
  actions?: ReactNode;
  period?: ReactNode;
  children: ReactNode;
  muted?: boolean;
}
export function Card({ title, actions, period, children, muted = false }: CardProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={classNames(styles.card, muted && styles.mutedCard)}
    >
      <header className={styles.cardHeader}>
        <h2 id={titleId} className={styles.cardTitle}>
          {title}
        </h2>
        <div className={styles.cardActions}>
          {actions}
          {period}
        </div>
      </header>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}
