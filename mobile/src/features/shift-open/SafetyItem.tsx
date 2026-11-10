import { View } from "react-native";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { CheckRow } from "../../ui/CheckRow.tsx";
import type { CheckValue } from "../../ui/CheckRow.tsx";
import { ShiftAction } from "./ShiftAction.tsx";
import { ShiftField } from "./ShiftField.tsx";
import type { Check, ChecklistItem } from "./domain.ts";

interface Props {
  readonly item: ChecklistItem;
  readonly check?: Check;
  readonly onChange: (check: Check) => void;
}

function toValue(check: Check | undefined): CheckValue | null {
  if (check === undefined) return null;
  return check.result === "ok" ? "good" : "fault";
}

/** One safety point: Bien / Con falla, then (only on a fault) how serious it is and what it is. */
export function SafetyItem({ item, check, onChange }: Props) {
  const t = useT();
  const locale = useLocale();
  const label = locale === "en" && item.label_en ? item.label_en : item.label_es;
  const isFault = check !== undefined && check.result !== "ok";
  const set = (result: Check["result"]) => {
    onChange({ item: item.code, result, ...(check?.note === undefined ? {} : { note: check.note }) });
  };
  const needsNote = isFault ? check.result === "severe" : false;
  return (
    <View className="gap-3">
      <CheckRow
        label={label}
        value={toValue(check)}
        onChange={(value) => {
          if (value === "good") set("ok");
          else if (!isFault) set("minor");
        }}
      />
      {isFault ? (
        <View className="gap-3 pl-3">
          <ShiftAction
            label={t("field.open.faultMinor")}
            selected={check.result === "minor"}
            onPress={() => {
              set("minor");
            }}
          />
          <ShiftAction
            label={t("field.open.faultSevere")}
            selected={check.result === "severe"}
            onPress={() => {
              set("severe");
            }}
          />
        </View>
      ) : null}
      {check !== undefined && (needsNote || item.is_other || isFault) ? (
        <ShiftField
          label={t(
            needsNote || item.is_other ? "field.open.noteRequired" : "field.open.noteOptional",
          )}
          value={check.note ?? ""}
          onChange={(note) => {
            onChange({ ...check, note });
          }}
        />
      ) : null}
    </View>
  );
}
