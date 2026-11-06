import type { AriaAttributes } from "react";
interface ButtonStateInput {
  disabled?: boolean;
  "aria-disabled"?: AriaAttributes["aria-disabled"];
}
/** Focusable blocked controls keep their announced state and cannot activate. */
export function getButtonState(loading: boolean, props: ButtonStateInput) {
  const declared = props["aria-disabled"];
  const isDisabled = loading || props.disabled === true || declared === true || declared === "true";
  return { isDisabled, ariaDisabled: loading || props.disabled ? true : declared };
}
