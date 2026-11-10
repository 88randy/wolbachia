import { useEffect, useRef, useState } from "react";
export function useTypeAttempt(revision: number) {
  const active = useRef<number | null>(null);
  const serial = useRef(0);
  const [isBusy, setBusy] = useState(false);
  useEffect(() => {
    active.current = null;
    setBusy(false);
  }, [revision]);
  function start() {
    const token = ++serial.current;
    active.current = token;
    setBusy(true);
    return token;
  }
  function finish(token: number) {
    if (active.current === token) {
      active.current = null;
      setBusy(false);
    }
  }
  function isCurrent(token: number) {
    return active.current === token;
  }
  return { active, start, finish, isCurrent, isBusy };
}
