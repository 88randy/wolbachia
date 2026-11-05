import { useId } from "react";
import type { ComponentPropsWithoutRef } from "react";
import styles from "./catalogs.module.css";
interface Props extends ComponentPropsWithoutRef<"button"> {
  reason: string | undefined;
  isFocusableWhenBlocked?: boolean;
}
/** State blockers are visible and associated with the control, including for touch and keyboard. */
export function CatalogActionButton({
  reason,
  isFocusableWhenBlocked = false,
  onClick,
  children,
  ...button
}: Props) {
  const reasonId = useId();
  const isBlocked = reason !== undefined;
  return (
    <span className={styles.blockedAction}>
      <button
        type="button"
        {...button}
        disabled={isBlocked && !isFocusableWhenBlocked}
        aria-disabled={isBlocked}
        aria-describedby={isBlocked ? reasonId : undefined}
        title={reason}
        onClick={(event) => {
          if (!isBlocked) onClick?.(event);
        }}
      >
        {children}
      </button>
      <span id={reasonId} hidden={!isBlocked} className={styles.blockedReason}>
        {reason}
      </span>
    </span>
  );
}
