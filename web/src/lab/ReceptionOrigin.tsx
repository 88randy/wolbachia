import { BagTracePanel } from "./trace/BagTracePanel";
import type { ReceptionResult } from "./reception-command";

const SHOWS_ORIGIN = new Set(["received", "already_received"]);

/** Right after a bag is scanned, where its paddle came from (compact; the full origin opens in a drawer). */
export function ReceptionOrigin({ result }: { result: ReceptionResult | null }) {
  if (!result?.subject || !SHOWS_ORIGIN.has(result.code)) return null;
  return <BagTracePanel key={result.subject} code={result.subject} variant="compact" />;
}
