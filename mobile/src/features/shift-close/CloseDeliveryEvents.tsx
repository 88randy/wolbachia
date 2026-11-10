import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { closeDeliveryKey } from "./domain.ts";
import type { CloseSnapshot } from "./service.ts";

export function CloseDeliveryEvents({ events }: { readonly events: CloseSnapshot["events"] }) {
  const t = useT();
  return (
    <>
      {events.map((event) => (
        <Card key={event.envelope.id}>
          <AppText variant="caption">{event.envelope.id}</AppText>
          <AppText>{t(closeDeliveryKey([event]))}</AppText>
        </Card>
      ))}
    </>
  );
}
