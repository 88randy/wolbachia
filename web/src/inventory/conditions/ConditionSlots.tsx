import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { minuteText } from "../inventory-form-values";
export function ConditionSlots({ slots }: { slots: Schemas["ConditionStatus"]["slots"] }) {
  const { t } = useTranslation();
  return (
    <ul>
      {slots.map((slot) => (
        <li key={slot.slot}>
          {slot.window?.length === 2
            ? `${minuteText(slot.window[0] ?? 0)}–${minuteText(slot.window[1] ?? 0)}`
            : t("conditions.state.noWindow")}
          {" · "}
          {t(slot.is_complete ? "conditions.state.complete" : "conditions.state.missing")}
        </li>
      ))}
    </ul>
  );
}
