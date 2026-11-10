import type { ReactNode } from "react";
import page from "../../styles/page.module.css";
import styles from "./permits.module.css";

interface Props {
  title: string;
  hint: string;
  children?: ReactNode;
}

/** Title, hint and the primary action of W43 and W44. */
export function PermitsHeader({ title, hint, children }: Props) {
  return (
    <div className={styles.header}>
      <div>
        <h1 className={page.title}>{title}</h1>
        <p className={styles.hint}>{hint}</p>
      </div>
      {children}
    </div>
  );
}
