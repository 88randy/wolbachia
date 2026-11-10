import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "../../forms/Select";
import { WriteOffCodeLookup } from "./WriteOffCodeLookup";
import { WriteOffLotFields } from "./WriteOffLotFields";
import type { MessageKey } from "@wolbachia/i18n";
import type { WriteOffForm, WriteOffKind } from "./use-write-off-form";

const KIND_KEYS: Record<WriteOffKind, MessageKey> = {
  lot: "allocation.writeOff.kindLot",
  bag: "allocation.writeOff.kindBag",
};

/** Pick Lot or Bag (only the kinds the user may dispose), resolve its code, then lot specifics. */
export function WriteOffTargetFields({ form }: { form: WriteOffForm }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <>
      {form.kinds.length > 1 && (
        <Select
          id={id}
          label={t("allocation.writeOff.fieldKind")}
          value={form.kind}
          options={form.kinds.map((kind) => ({
            value: kind,
            label: t(KIND_KEYS[kind]),
          }))}
          onChange={(event) => {
            form.changeKind(event.target.value === "bag" ? "bag" : "lot");
          }}
        />
      )}
      <WriteOffCodeLookup form={form} />
      <WriteOffLotFields form={form} />
    </>
  );
}
