import type { Ref } from "react";
import styles from "./form.module.css";

interface FormAlertProps {
  id: string;
  /** What happened, in bold. */
  title: string;
  /** What to do next. */
  text?: string | undefined;
  /** Receives focus when the form fails, so keyboard and screen-reader users land on it. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Error summary of a form. `role="alert"` announces it when it appears; it is focusable only by
 * script (tabIndex -1) so the form can move focus here after a failed submit.
 */
export function FormAlert({ id, title, text, ref }: FormAlertProps) {
  return (
    <div id={id} ref={ref} role="alert" tabIndex={-1} className={styles.alert}>
      <p className={styles.alertTitle}>{title}</p>
      {text !== undefined && <p className={styles.alertText}>{text}</p>}
    </div>
  );
}
