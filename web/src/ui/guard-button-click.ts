import type { MouseEventHandler } from "react";
interface ButtonClickOptions {
  isBusy: boolean;
  onClick: MouseEventHandler<HTMLButtonElement> | undefined;
}
/** aria-disabled actions keep focus but must refuse a second activation. */
export function guardButtonClick({
  isBusy,
  onClick,
}: ButtonClickOptions): MouseEventHandler<HTMLButtonElement> {
  return (event) => {
    if (isBusy) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
}
