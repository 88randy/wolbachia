import type { MouseEvent } from "react";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
import styles from "./form.module.css";

interface SubmitButtonProps {
  label: string;
  /** Text while the request is in flight. */
  busyLabel: string;
  isBusy: boolean;
}

/**
 * Full-width primary submit button. While busy it is `aria-disabled` instead of `disabled`, so a
 * keyboard user does not lose focus, and a second press does not send the form again.
 */
export function SubmitButton({ label, busyLabel, isBusy }: SubmitButtonProps) {
  function ignoreWhileBusy(event: MouseEvent) {
    if (isBusy) event.preventDefault();
  }
  return (
    <button
      type="submit"
      className={classNames(buttons.button, buttons.primary, styles.submit)}
      aria-disabled={isBusy}
      onClick={ignoreWhileBusy}
    >
      {isBusy ? busyLabel : label}
    </button>
  );
}
