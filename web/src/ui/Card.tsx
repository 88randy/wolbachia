import { useId } from "react";
import type { ReactNode } from "react";
import { classNames } from "../styles/class-names";
import { CardHeader } from "./CardHeader";
import styles from "./ui.module.css";
export interface CardProps {
  title: ReactNode;
  titleId?: string;
  headingLevel?: 1 | 2 | 3;
  className?: string;
  actions?: ReactNode;
  period?: ReactNode;
  children: ReactNode;
  muted?: boolean;
}
export function Card(props: CardProps) {
  const generatedId = useId();
  const id = props.titleId ?? generatedId;
  return (
    <section
      aria-labelledby={id}
      className={classNames(styles.card, props.muted && styles.mutedCard, props.className)}
    >
      <CardHeader {...props} id={id} headingLevel={props.headingLevel ?? 2} />
      <div className={styles.cardBody}>{props.children}</div>
    </section>
  );
}
