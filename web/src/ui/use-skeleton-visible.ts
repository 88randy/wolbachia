import { useEffect, useState } from "react";
import { LOADING_DELAY_MS } from "./use-delayed-flag";
export const SKELETON_DELAY_MS = LOADING_DELAY_MS;
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
