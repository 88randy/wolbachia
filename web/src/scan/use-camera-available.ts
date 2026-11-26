import { useEffect, useState } from "react";
import { canUseCamera, hasVideoInput } from "./camera";

/** Whether to offer the camera button: the browser can open one and the device has one. */
export function useCameraAvailable(): boolean {
  const [isAvailable, setAvailable] = useState(canUseCamera);
  useEffect(() => {
    let isCurrent = true;
    void hasVideoInput().then((found) => {
      if (isCurrent) setAvailable(found);
    });
    return () => {
      isCurrent = false;
    };
  }, []);
  return isAvailable;
}
