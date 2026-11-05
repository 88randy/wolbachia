import { useId } from "react";
import { Button } from "../ui/Button";
import styles from "./form.module.css";
interface SubmitButtonProps {
  label: string;
  busyLabel: string;
  isBusy: boolean;
}
/** A pending submission preserves width and focus, and refuses duplicate presses. */
export function SubmitButton({ label, busyLabel, isBusy }: SubmitButtonProps) {
  const statusId = useId();
  return (
    <>
      <Button
        type="submit"
        loading={isBusy}
        className={styles.submit}
        aria-describedby={isBusy ? statusId : undefined}
      >
        {label}
      </Button>
      <span id={statusId} role="status" className={styles.srOnly}>
        {isBusy ? busyLabel : ""}
      </span>
    </>
  );
}
