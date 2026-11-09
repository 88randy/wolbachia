import { isReceiptReadOnly } from "./editing.ts";
import { View } from "react-native";
import { ReceiptLine } from "./ReceiptLine.tsx";
import type { M05Model } from "./use-m-05.ts";

export function ReceiptLines({ model }: { readonly model: M05Model }) {
  return (
    <View>
      {model.state?.draft?.lines.map((line) => (
        <ReceiptLine
          key={line.id}
          line={line}
          disabled={isReceiptReadOnly(model)}
          onChange={(value) => {
            model.edit(
              `quantity.${line.id}`,
              (eventId) => model.service.quantity(line.id, value, eventId),
              (draft) => ({
                ...draft,
                signature: null,
                lines: draft.lines.map((current) =>
                  current.id === line.id ? { ...current, quantity: value } : current,
                ),
              }),
            );
          }}
        />
      ))}
    </View>
  );
}
