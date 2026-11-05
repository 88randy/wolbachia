import { useEffect, useState } from "react";
/** Native connectivity gates writes; reads keep their existing retry/error states. */
export function useOnline(): boolean {
  const [isOnline, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return isOnline;
}
