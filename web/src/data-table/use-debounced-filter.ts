import { useEffect, useRef, useState } from "react";

export const FILTER_DEBOUNCE_MS = 300;

/**
 * A text filter that applies while typing: the field keeps the draft and the URL changes 300 ms
 * after the last keystroke (one request, one history entry). An outside change of the URL value
 * (a chip removed, "Limpiar filtros") replaces the draft.
 */
export function useDebouncedFilter(
  value: string | undefined,
  onChange: (value: string | undefined) => void,
) {
  const [draft, setDraft] = useState(value ?? "");
  const [seen, setSeen] = useState(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  if (seen !== value) {
    setSeen(value);
    setDraft(value ?? "");
  }
  useEffect(() => {
    const next = draft.trim() === "" ? undefined : draft.trim();
    if (next === value) return;
    const timer = window.setTimeout(() => {
      onChangeRef.current(next);
    }, FILTER_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, value]);
  return [draft, setDraft] as const;
}
