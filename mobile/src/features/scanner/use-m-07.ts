import { useEffect, useRef, useState } from "react";
import { useCameraPermissions } from "expo-camera";
import { AppState, Linking, Vibration } from "react-native";
import { useServices } from "../../app/services-context.ts";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { useM08 } from "../ovitrap-check/use-m-08.ts";
import type { QrKind } from "../ovitrap-check/types.ts";
import type { ScannerError } from "./domain.ts";
import { useScannerLifecycle } from "./use-scanner-lifecycle.ts";
import { ensureCameraAccess } from "./camera-access.ts";
import type { ScannerDestination } from "./service.ts";
import type { Route } from "../../navigation/routes.ts";

const SCAN_FEEDBACK_MS = 30;

type CameraError = "denied" | "blocked" | "cameraFailed";

/**
 * Opens the camera by itself: asks for the permission when it is missing and always lands on a
 * visible result (preview, or a message with a button). The system prompt sends the app to the
 * background, so its answer is never discarded because of that; the camera only shows while the
 * app is unlocked and in front, and it comes back by itself when the app returns.
 */
function useCameraStart(lifecycle: ReturnType<typeof useScannerLifecycle>) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [isRequesting, setRequesting] = useState(false);
  const isRunning = useRef(false);
  const mustRerun = useRef(false);
  const start = async () => {
    if (isRunning.current) return;
    isRunning.current = true;
    setRequesting(true);
    setCameraError(null);
    let isGranted = false;
    try {
      const access = await ensureCameraAccess(permission, requestPermission);
      isGranted = access === "granted";
      if (access !== "granted") setCameraError(access);
      else if (lifecycle.canShowCamera()) lifecycle.setCamera(true);
    } catch {
      setCameraError("cameraFailed");
    } finally {
      isRunning.current = false;
      setRequesting(false);
    }
    const rerun = mustRerun.current;
    mustRerun.current = false;
    // The app came back to the front while asking; show the camera now if it was allowed.
    if (rerun && isGranted) {
      await start();
    }
  };
  const isHidden = !lifecycle.isCameraVisible;
  useEffect(() => {
    const app = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !isHidden) return;
      if (isRunning.current) mustRerun.current = true;
      else void start();
    });
    return () => {
      app.remove();
    };
  });
  return { start, isRequesting, cameraError, setCameraError };
}
function useScanOrigin(eventId: string | null | undefined) {
  const model = useM08();
  const origin = useRef(eventId);
  if (origin.current === undefined && model.state !== null)
    origin.current = model.state.draft?.eventId ?? null;
  const retry = () => {
    model.setError(null);
    return model.refresh();
  };
  return {
    eventId: origin.current ?? null,
    isReady: origin.current !== undefined,
    isLoading: origin.current === undefined && model.errorKey === null,
    error: model.errorKey ? ("storage" as const) : null,
    retry,
  };
}
function useScanCommand(
  options: { readonly expected?: QrKind; readonly bindsLabel: boolean },
  lifecycle: ReturnType<typeof useScannerLifecycle>,
  eventId: string | null | undefined,
) {
  const { expected, bindsLabel } = options;
  const { scanner } = useServices();
  const origin = useScanOrigin(eventId);
  const push = useScannerNavigation();
  const [error, setError] = useState<ScannerError | null>(null);
  const [isBusy, setBusy] = useState(false);
  const shared = {
    scanner,
    lifecycle,
    push,
    setError,
    setBusy,
    eventId: origin.eventId,
  };
  const read = (value: string, isManual = false) =>
    performScan({ ...shared, input: { value, isManual, expected, bindsLabel } });
  return {
    read,
    error: error ?? origin.error,
    isBusy: isBusy || !origin.isReady,
    isLoading: origin.isLoading,
    setError,
    retryOrigin: origin.retry,
  };
}
function useScannerNavigation() {
  const { push, goBack } = useNavigation();
  return (route: Route) => {
    goBack();
    push(route);
  };
}
/** Manual input and origin capture survive camera failures and scanner retries. */
export function useM07(expected?: QrKind, eventId?: string | null, bindsLabel = false) {
  const lifecycle = useScannerLifecycle();
  const camera = useCameraStart(lifecycle);
  const command = useScanCommand({ expected, bindsLabel }, lifecycle, eventId);
  const [code, setCode] = useState("");
  const [isTorchOn, setTorch] = useState(false);
  const retry = () => {
    lifecycle.session.cancel();
    command.setError(null);
    void command.retryOrigin().catch(() => {
      command.setError("storage");
    });
  };
  return {
    ...lifecycle,
    ...camera,
    ...command,
    code,
    setCode,
    isTorchOn,
    setTorch,
    retry,
    ...cameraRecovery(lifecycle, camera),
  };
}
export type M07Model = ReturnType<typeof useM07>;

function cameraRecovery(
  lifecycle: ReturnType<typeof useScannerLifecycle>,
  camera: ReturnType<typeof useCameraStart>,
) {
  return {
    settings: () => {
      void Linking.openSettings().catch(() => {
        camera.setCameraError("cameraFailed");
      });
    },
    failed: () => {
      lifecycle.stop();
      camera.setCameraError("cameraFailed");
    },
  };
}

interface ScanCommand {
  readonly scanner: ReturnType<typeof useServices>["scanner"];
  readonly lifecycle: ReturnType<typeof useScannerLifecycle>;
  readonly push: (route: Route) => void;
  readonly setError: (error: ScannerError | null) => void;
  readonly setBusy: (isBusy: boolean) => void;
  readonly input: import("./domain.ts").ScannerInput;
  readonly eventId: string | null;
}
async function performScan(command: ScanCommand): Promise<void> {
  const { lifecycle, input, scanner } = command;
  const current = lifecycle.lease();
  command.setError(null);
  command.setBusy(true);
  try {
    const result = await lifecycle.session.run(
      `${String(input.isManual)}:${input.value}`,
      (active) =>
        scanner.open({
          input,
          eventId: command.eventId,
          isCurrent: () => active() && current(),
        }),
    );
    if (current()) finishScan(command, result);
  } catch {
    if (current()) command.setError("storage");
  } finally {
    command.setBusy(lifecycle.session.isBusy);
  }
}
function finishScan(command: ScanCommand, result: ScannerDestination | "duplicate"): void {
  if (result === "duplicate") {
    command.setError("duplicate");
    return;
  }
  if ("error" in result) {
    command.setError(result.error);
    return;
  }
  command.lifecycle.stop();
  Vibration.vibrate(SCAN_FEEDBACK_MS);
  command.push(result.route);
}
