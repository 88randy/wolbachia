import { CatalogChoices } from "./CatalogChoices.tsx";
import type { LifecycleProps } from "./model.ts";
export function ReasonChoices({ draft, model }: LifecycleProps) {
  return (
    <CatalogChoices
      items={draft.catalog?.[draft.kind] ?? []}
      code={draft.reasonCode}
      isBusy={model.isBusy}
      choose={(reasonCode) => {
        model.edit({ reasonCode, otherText: "" }, draft.eventId);
      }}
    />
  );
}
