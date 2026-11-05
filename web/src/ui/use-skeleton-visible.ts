import { useEffect, useState } from "react";
export const SKELETON_DELAY_MS = 150;
/** Reserve final geometry immediately; defer its shimmer to avoid flashing for fast loads. */
export function useSkeletonVisible() {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsVisible(true);
    }, SKELETON_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);
  return isVisible;
}
