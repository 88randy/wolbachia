import { useT } from "../../i18n/I18nProvider.tsx";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import { problemMessageKey } from "../../sync/inbox-model.ts";
import { Notice } from "../../ui/Notice.tsx";
export function ServerOutcome({ opening }: { readonly opening: OutboxEvent }) {
  const t = useT();
  if (opening.result === null || opening.status === "sent") return null;
  const message = problemMessageKey({
    id: opening.envelope.id,
    type: "shift.open",
    status: opening.status,
    deviceTime: opening.envelope.device_time,
    attempts: opening.attempts,
    lastError: opening.lastError,
    result: opening.result,
  });
  return <Notice tone="warning" icon="alert" message={t(message)} />;
}
