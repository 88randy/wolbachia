import type { ReactNode } from "react";
import { classNames } from "../styles/class-names";
import styles from "./ui.module.css";
interface CardHeaderProps {
  title: ReactNode;
  id: string;
  headingLevel: 1 | 2 | 3;
  actions?: ReactNode;
  period?: ReactNode;
}
const HEADINGS = { 1: "h1", 2: "h2", 3: "h3" } as const;
export function CardHeader({ title, id, headingLevel, actions, period }: CardHeaderProps) {
  const Heading = HEADINGS[headingLevel];
  return (
    <div className={styles.cardHeader} data-has-period={period ? true : undefined}>
      <Heading
        id={id}
        className={classNames(styles.cardTitle, headingLevel === 1 && styles.pageTitle)}
      >
        {title}
      </Heading>
      {actions && <div className={styles.cardActions}>{actions}</div>}
      {period && <div className={styles.cardPeriod}>{period}</div>}
    </div>
  );
}
