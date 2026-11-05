import { useCallback, useRef, useState } from "react";
/** Tokens are released once, on settlement or unmount. Save checks the ref synchronously. */
export function useScopeLookups() {
  const pending = useRef(new Set<symbol>());
  const [count, setCount] = useState(0);
  const begin = useCallback(() => {
    const token = Symbol();
    pending.current.add(token);
    setCount(pending.current.size);
    return () => {
      if (pending.current.delete(token)) setCount(pending.current.size);
    };
  }, []);
  return { begin, hasPending: count > 0, isPending: () => pending.current.size > 0 };
}
