import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ButtonContent } from "./ButtonContent";
import { guardButtonClick } from "./guard-button-click";
import { classNames } from "../styles/class-names";
import styles from "../styles/button.module.css";

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: "primary" | "secondary" | "tertiary" | "ghost";
  size?: "sm" | "md" | "lg" | "xl";
  leadingIcon?: ReactNode;
  loading?: boolean;
}

/** A busy action preserves its label and focus while preventing duplicate clicks. */
export function Button({
  variant = "primary",
  size = "md",
  leadingIcon,
  loading = false,
  children,
  className,
  onClick,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      className={classNames(styles.button, styles[variant], styles[size], className)}
      aria-busy={loading || undefined}
      aria-disabled={loading || props.disabled || undefined}
      onClick={guardButtonClick({ isBusy: loading || props.disabled === true, onClick })}
    >
      <ButtonContent loading={loading} icon={leadingIcon}>
        {children}
      </ButtonContent>
    </button>
  );
}
