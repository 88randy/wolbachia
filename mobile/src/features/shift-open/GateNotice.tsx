import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { Gate } from "./domain.ts";
export function GateNotice({ gate }: { readonly gate: Gate | null }) {
  const t = useT();
  if (gate === null) return null;
  return (
    <Notice
      tone="critical"
      icon="alert"
      message={t(gate === "note" ? "mobile.shiftOpen.noteGate" : `mobile.shiftOpen.${gate}`)}
    />
  );
}
