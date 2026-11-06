import type { KeyboardEvent } from "react";
const STEPS: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: 1,
  ArrowUp: -1,
};
/** Vertical navigation retains the action, skipping fixed read-only profiles. */
export function moveMatrixFocus(event: KeyboardEvent<HTMLButtonElement>) {
  const step = STEPS[event.key];
  if (step === undefined) return;
  const isVertical = event.key === "ArrowDown" || event.key === "ArrowUp";
  const button = event.currentTarget;
  const root = button.closest(isVertical ? "table" : "tr");
  const selector = isVertical
    ? `button[data-permission="${button.dataset["permission"] ?? ""}"]`
    : "button[data-permission]";
  const cells = Array.from(root?.querySelectorAll<HTMLButtonElement>(selector) ?? []);
  event.preventDefault();
  cells[(cells.indexOf(button) + step + cells.length) % cells.length]?.focus();
}
