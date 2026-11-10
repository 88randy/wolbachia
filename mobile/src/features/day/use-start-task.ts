import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import type { AssignedTask } from "./types.ts";

/**
 * What "Empezar" opens for a point of the route: a release goes to its own capture, a new trap to
 * the placing wizard, and every other action starts by scanning the ovitrap QR.
 */
export function useStartTask(): (task: AssignedTask) => void {
  const { push } = useNavigation();
  return (task) => {
    if (task.action === "release")
      push({ name: "releaseCapture", taskId: task.id, deviceId: null, manualCapture: false });
    else if (task.action === "place") push({ name: "ovitrapCapture" });
    else push({ name: "qrScanner" });
  };
}
