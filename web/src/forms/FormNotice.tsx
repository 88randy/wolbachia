import { useEffect, useRef } from "react";
import styles from "./form.module.css";

interface FormNoticeProps {
  title: string;
  text?: string;
  /** Moves focus to the notice when it appears (after a submit replaced the form). */
  shouldFocus?: boolean;
}

/** A neutral confirmation (not an error): announced politely with `role="status"`. */
export function FormNotice({ title, text, shouldFocus = false }: FormNoticeProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shouldFocus) ref.current?.focus();
  }, [shouldFocus]);
  return (
    <div ref={ref} role="status" tabIndex={-1} className={styles.success}>
      <p className={styles.alertTitle}>{title}</p>
      {text !== undefined && <p className={styles.alertText}>{text}</p>}
    </div>
  );
}
