import { useId } from "react";
import { Button } from "../ui/Button";
import styles from "./form.module.css";
interface SubmitButtonProps {
  label: string;
  busyLabel: string;
  isBusy: boolean;
  /** Full width (sign-in pages). Default: own width, bottom right. */
  block?: boolean;
}
/** A pending submission preserves width and focus, and refuses duplicate presses. */
export function SubmitButton({ label, busyLabel, isBusy, block = false }: SubmitButtonProps) {
  const statusId = useId();
  return (
    <>
      <Button
        type="submit"
        loading={isBusy}
        aria-disabled={isBusy}
        aria-label={isBusy ? busyLabel : undefined}
        className={block ? styles.submitBlock : styles.submit}
        aria-describedby={isBusy ? statusId : undefined}
      >
        {label}
      </Button>
      <span
        id={statusId}
        role={isBusy ? "status" : undefined}
        aria-live="polite"
        className={styles.srOnly}
      >
        {isBusy ? busyLabel : ""}
      </span>
    </>
  );
}
