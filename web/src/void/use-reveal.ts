import { useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";

interface Reveal {
  isOpen: boolean;
  /** Spread on the element that wraps both the trigger and the revealed text. */
  wrapperProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: (event: FocusEvent<HTMLElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  };
}

interface State {
  isHovered: boolean;
  isFocused: boolean;
  isDismissed: boolean;
}

const CLOSED: State = { isHovered: false, isFocused: false, isDismissed: false };

const isActive = (state: State) => state.isHovered || state.isFocused;

/** Applies a change of pointer or focus; once both are gone the next visit starts fresh. */
function move(state: State, change: Partial<Pick<State, "isHovered" | "isFocused">>): State {
  const next = { ...state, ...change };
  return isActive(next) ? next : { ...next, isDismissed: false };
}

/**
 * Text shown on hover or keyboard focus that meets WCAG 1.4.13: it stays while the pointer moves
 * onto it (the wrapper holds both), it stays until the pointer or focus leaves, and Escape
 * dismisses it without moving focus. Once dismissed it comes back only after leaving and
 * returning.
 */
export function useReveal(): Reveal {
  const [state, setState] = useState(CLOSED);
  return {
    isOpen: isActive(state) && !state.isDismissed,
    wrapperProps: {
      onMouseEnter: () => {
        setState((current) => move(current, { isHovered: true }));
      },
      onMouseLeave: () => {
        setState((current) => move(current, { isHovered: false }));
      },
      onFocus: () => {
        setState((current) => move(current, { isFocused: true }));
      },
      onBlur: (event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setState((current) => move(current, { isFocused: false }));
      },
      onKeyDown: (event) => {
        if (event.key !== "Escape" || !isActive(state) || state.isDismissed) return;
        event.stopPropagation();
        setState((current) => ({ ...current, isDismissed: true }));
      },
    },
  };
}
