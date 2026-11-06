import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ButtonContent } from "./ButtonContent";
import { getButtonState } from "./button-state";
import { guardButtonClick } from "./guard-button-click";
import { classNames } from "../styles/class-names";
import styles from "../styles/button.module.css";
export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: "primary" | "secondary" | "tertiary" | "ghost";
  size?: "sm" | "md" | "lg" | "xl";
  leadingIcon?: ReactNode;
  loading?: boolean;
}
/** Busy and blocked actions retain focus and width while refusing duplicate activation. */
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
  const state = getButtonState(loading, props);
  const attributes = {
    ...props,
    type: props.type ?? "button",
    className: classNames(styles.button, styles[variant], styles[size], className),
    "aria-busy": loading || undefined,
    "aria-disabled": state.ariaDisabled,
    onClick: guardButtonClick({ isBusy: state.isDisabled, onClick }),
  };
  return (
    <button {...attributes}>
      <ButtonContent loading={loading} icon={leadingIcon}>
        {children}
      </ButtonContent>
    </button>
  );
}
