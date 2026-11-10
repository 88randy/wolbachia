import { useRef, useState } from "react";
import { useCameraPermissions } from "expo-camera";
import { Linking, Vibration } from "react-native";
import { useServices } from "../../app/services-context.ts";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { useM08 } from "../ovitrap-check/use-m-08.ts";
import type { QrKind } from "../ovitrap-check/types.ts";
import type { ScannerError } from "./domain.ts";
import { useScannerLifecycle } from "./use-scanner-lifecycle.ts";
import { ReceiptScannerSession } from "../supply-receipt/scanner-session.ts";
import type { ScannerDestination } from "./service.ts";
import type { Route } from "../../navigation/routes.ts";

const SCAN_FEEDBACK_MS = 30;

function useCameraStart(lifecycle: ReturnType<typeof useScannerLifecycle>) {
  const session = useRef(new ReceiptScannerSession()).current;
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraError, setCameraError] = useState<"denied" | "cameraFailed" | null>(null);
  const [isRequesting, setRequesting] = useState(false);
  const start = async () => {
    if (session.isRequesting) return;
    lifecycle.stop();
    const isCurrent = lifecycle.lease();
    setRequesting(true);
    setCameraError(null);
    try {
      const result = await session.start({
        current: lifecycle.permissionContext,
        permission,
        requestPermission,
      });
      if (!isCurrent()) return;
      lifecycle.setCamera(result.kind === "ready");
      if (result.kind === "denied") setCameraError("denied");
      else if (result.kind !== "ready") setCameraError("cameraFailed");
    } catch {
      if (isCurrent()) setCameraError("cameraFailed");
    } finally {
      setRequesting(false);
    }
  };
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
  expected: QrKind | undefined,
  lifecycle: ReturnType<typeof useScannerLifecycle>,
  eventId: string | null | undefined,
) {
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
    performScan({ ...shared, input: { value, isManual, expected } });
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
export function useM07(expected?: QrKind, eventId?: string | null) {
  const lifecycle = useScannerLifecycle();
  const camera = useCameraStart(lifecycle);
  const command = useScanCommand(expected, lifecycle, eventId);
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
