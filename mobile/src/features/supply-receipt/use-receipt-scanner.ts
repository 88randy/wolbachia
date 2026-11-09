import { useCallback, useEffect, useRef, useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { AppState } from "react-native";
import { useCameraPermissions } from "expo-camera";
import { useServices } from "../../app/services-context.ts";
import { acceptedEvidenceOwner } from "../../attachments/accepted-owner.ts";
import { ownerKey } from "../../attachments/types.ts";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { ReceiptScannerSession } from "./scanner-session.ts";
import type { ReceiptScanTicket } from "./scanner-session.ts";
import type { M05Model } from "./use-m-05.ts";

function interactiveDraft(model: M05Model, route: string) {
  const state = model.state;
  return route === "supplyReceipt" && !model.isBusy && state?.ready && state.event === null
    ? state.draft
    : null;
}
function useScannerContext(model: M05Model) {
  const { auth, tokens, deviceId } = useServices();
  const { route } = useNavigation();
  const latest = useRef({ model, route });
  latest.current = { model, route };
  return useCallback(() => {
    const { model: current, route: screen } = latest.current;
    const snapshot = auth.getSnapshot();
    if (snapshot.phase !== "unlocked" || AppState.currentState !== "active") return null;
    const draft = interactiveDraft(current, screen.name);
    if (!draft) return null;
    const identity = acceptedEvidenceOwner({
      profile: snapshot.profile,
      credentials: tokens.getSnapshot(),
      deviceId,
    });
    return identity === null
      ? null
      : {
          eventId: draft.eventId,
          sessionKey: JSON.stringify([ownerKey(identity.owner), identity.sessionId]),
        };
  }, [auth, tokens, deviceId]);
}
function useScannerLifecycle(input: {
  readonly session: ReceiptScannerSession;
  readonly current: ReturnType<typeof useScannerContext>;
  readonly stop: () => void;
}) {
  const { auth, tokens } = useServices();
  const { session, current, stop } = input;
  useEffect(() => {
    const invalidate = () => {
      const context = current();
      if (session.observe(context) || context === null) stop();
    };
    const unsub = [auth.subscribe(invalidate), tokens.subscribe(invalidate)];
    const app = AppState.addEventListener("change", (state) => {
      if (state !== "active") stop();
    });
    return () => {
      session.cancel();
      app.remove();
      for (const remove of unsub) remove();
    };
  }, [auth, tokens, session, current, stop]);
}
function useScannerPermission(input: {
  readonly session: ReceiptScannerSession;
  readonly current: ReturnType<typeof useScannerContext>;
  readonly show: (ticket: ReceiptScanTicket) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isRequesting, setRequesting] = useState(false);
  const [errorKey, setError] = useState<MessageKey | null>(null);
  const start = async () => {
    setRequesting(true);
    setError(null);
    const result = await input.session.start({
      current: input.current,
      permission,
      requestPermission,
    });
    setRequesting(input.session.isRequesting);
    if (result.kind === "ready") input.show(result.ticket);
    else if (result.kind !== "busy")
      setError(
        result.kind === "denied"
          ? "mobile.supplyReceipt.scannerPermission"
          : "mobile.supplyReceipt.scannerRetry",
      );
  };
  return { start, isRequesting, errorKey, setError };
}
/** Preview is removed on lock/background/navigation and never resumes from a stale permission result. */
export function useReceiptScanner(model: M05Model) {
  const session = useRef(new ReceiptScannerSession()).current;
  const current = useScannerContext(model);
  const [ticket, setTicket] = useState<ReceiptScanTicket | null>(null);
  const stop = useCallback(() => {
    session.cancel();
    setTicket(null);
  }, [session]);
  const permission = useScannerPermission({ session, current, show: setTicket });
  useScannerLifecycle({ session, current, stop });
  const isVisible = ticket !== null && session.isCurrent(ticket, current());
  useEffect(() => {
    if (ticket !== null && !isVisible) stop();
  }, [ticket, isVisible, stop]);
  const read = (value: string) => {
    if (ticket === null) return;
    const eventId = session.consume(ticket, current());
    setTicket(null);
    if (eventId !== null) void model.run(() => model.service.scan(value, eventId));
  };
  const failed = () => {
    stop();
    permission.setError("mobile.supplyReceipt.scannerUnavailable");
  };
  return { ...permission, stop, read, failed, isVisible };
}
export type ReceiptScannerModel = ReturnType<typeof useReceiptScanner>;
