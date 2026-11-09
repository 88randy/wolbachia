import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { FuelField } from "./FuelField.tsx";
import { FuelRefillChoice } from "./FuelRefillChoice.tsx";
import { FuelMotorcycle } from "./FuelMotorcycle.tsx";
import type { M11Model } from "./use-m-11.ts";

const FIELDS = ["litres", "amount", "odometer"] as const;
const LABEL_KEYS = {
  litres: "mobile.fuel.litres",
  amount: "mobile.fuel.amount",
  odometer: "mobile.fuel.odometer",
} as const;

export function FuelForm({ model }: { readonly model: M11Model }) {
  const draft = model.state?.draft;
  if (!draft) return null;
  const disabled = model.isBusy || !model.state?.ready || model.state.event !== null;
  return (
    <Card>
      <FuelMotorcycle code={draft.motorcycleCode} />
      {FIELDS.map((field) => (
        <FuelField
          key={`${draft.eventId}:${field}`}
          field={field}
          labelKey={LABEL_KEYS[field]}
          value={draft[field]}
          disabled={disabled}
          isSubmitted={model.submittedId === draft.eventId}
          onChange={(value) => {
            model.edit(field, value);
          }}
        />
      ))}
      <AppText variant="caption">{draft.currency}</AppText>
      <FuelRefillChoice model={model} />
    </Card>
  );
}
