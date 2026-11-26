import type { ReactNode } from "react";
import { Button, type ButtonProps } from "../ui/Button";
import { Tooltip } from "../ui/Tooltip";
import styles from "./annotation.module.css";

interface Props extends ButtonProps {
  label: string;
  shortcut?: string;
  children: ReactNode;
}

export function AnnotationIconButton({ label, shortcut, children, ...props }: Props) {
  return (
    <Tooltip content={shortcut ? `${label} (${shortcut})` : label}>
      <Button variant="ghost" size="sm" className={styles.iconButton} aria-label={label} {...props}>
        {children}
      </Button>
    </Tooltip>
  );
}
