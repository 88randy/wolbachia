import { useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { Vibration } from "react-native";
import type { MotorcycleOption } from "./domain.ts";
import { matchMotorcycle } from "./motorcycle-match.ts";

const SCAN_FEEDBACK_MS = 30;

export type ScanProblem = "denied" | "unknown" | null;

/** Opens the camera on demand and resolves a QR to a motorcycle of the downloaded list. */
export function useMotorcycleScan(
  options: readonly MotorcycleOption[],
  onFound: (option: MotorcycleOption) => void,
) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setScanning] = useState(false);
  const [problem, setProblem] = useState<ScanProblem>(null);
  const start = async () => {
    setProblem(null);
    const granted = permission?.granted === true || (await requestPermission()).granted;
    if (granted) setScanning(true);
    else setProblem("denied");
  };
  const stop = () => {
    setScanning(false);
  };
  const read = (data: string) => {
    const option = matchMotorcycle(data, options);
    if (option === null) {
      setProblem("unknown");
      setScanning(false);
      return;
    }
    Vibration.vibrate(SCAN_FEEDBACK_MS);
    setScanning(false);
    onFound(option);
  };
  return { isScanning, problem, start, stop, read };
}
