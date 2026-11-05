import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { classNames } from "../styles/class-names";
import styles from "../styles/button.module.css";
export function ButtonContent({
  loading,
  icon,
  children,
}: {
  loading: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <span className={classNames(styles.content, loading && styles.busyContent)}>
        {icon}
        {children}
      </span>
      {loading && <LoaderCircle aria-hidden="true" strokeWidth={1.5} className={styles.spinner} />}
    </>
  );
}
