import { useId } from "react";
import { Button } from "../ui/Button";
import type { ButtonProps } from "../ui/Button";
import styles from "./catalogs.module.css";
interface Props extends ButtonProps {
  reason: string | undefined;
  isFocusableWhenBlocked?: boolean;
}
/** State blockers remain visible and associated with the same keyboard/touch control. */
export function CatalogActionButton(props: Props) {
  const { reason, isFocusableWhenBlocked = false, ...button } = props;
  const reasonId = useId();
  const isBlocked = reason !== undefined;
  const blocked = {
    disabled: isBlocked && !isFocusableWhenBlocked,
    "aria-disabled": isBlocked,
    "aria-describedby": isBlocked ? reasonId : undefined,
    title: reason,
  };
  return (
    <span className={styles.blockedAction}>
      <Button
        {...button}
        {...blocked}
        variant={props.variant ?? "ghost"}
        size={props.size ?? "sm"}
        onClick={(event) => {
          if (!isBlocked) props.onClick?.(event);
        }}
      >
        {props.children}
      </Button>
      <span id={reasonId} hidden={!isBlocked} className={styles.blockedReason}>
        {reason}
      </span>
    </span>
  );
}
