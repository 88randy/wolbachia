import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ButtonContent } from "./ButtonContent";
import { buttonVariants } from "./button-variants";
import { getButtonState } from "./button-state";
import { guardButtonClick } from "./guard-button-click";
export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: "primary" | "secondary" | "tertiary" | "ghost" | "destructive";
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
    className: cn(buttonVariants({ variant, size }), className),
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
