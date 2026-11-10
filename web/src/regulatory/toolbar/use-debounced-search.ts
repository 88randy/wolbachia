import { useEffect, useRef, useState } from "react";

const SEARCH_DELAY_MS = 300;

/**
 * A search box that applies itself 300 ms after the last keystroke (no "Apply" button) and follows
 * the address when it changes from outside (a removed chip, "Clear filters", the back button).
 */
export function useDebouncedSearch(
  applied: string | undefined,
  apply: (value: string | undefined) => void,
) {
  const [value, setValue] = useState(applied ?? "");
  const latest = useRef(apply);
  const lastApplied = useRef(applied ?? "");
  useEffect(() => {
    latest.current = apply;
  });
  useEffect(() => {
    // An outside change of the address replaces what is typed.
    if ((applied ?? "") !== lastApplied.current) {
      lastApplied.current = applied ?? "";
      setValue(applied ?? "");
    }
  }, [applied]);
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed === lastApplied.current) return;
    const timer = setTimeout(() => {
      lastApplied.current = trimmed;
      latest.current(trimmed === "" ? undefined : trimmed);
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [value]);
  return { value, onChange: setValue };
}
