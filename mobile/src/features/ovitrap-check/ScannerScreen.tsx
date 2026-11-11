import { P11Screen } from "../scanner/P11Screen.tsx";
/** Existing M08 entry points retain their required resource kind in the shared scanner. */
export function ScannerScreen({
  target,
  eventId,
}: {
  readonly target: "ovitrap" | "bag" | "label";
  readonly eventId: string | null;
}) {
  if (target === "label") return <P11Screen expected="ovitrap" eventId={eventId} bindsLabel />;
  return <P11Screen expected={target} eventId={eventId} />;
}
