import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftField } from "./ShiftField.tsx";
import type { M04Model } from "./use-m-04.ts";
export function DraftNotes({ model }: { readonly model: M04Model }) {
  const t = useT();
  return (
    <ShiftField
      label={t("mobile.shiftOpen.note")}
      value={model.state?.draft?.note ?? ""}
      onChange={(note) => {
        model.edit({ note });
      }}
    />
  );
}
