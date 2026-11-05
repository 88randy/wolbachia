import { useTranslation } from "react-i18next";
import type { PointRelocation } from "./use-point-relocation";
export function RelocationControls({ form }: { form: PointRelocation }) {
  const { t } = useTranslation();
  return (
    <>
      <button type="submit" disabled={form.isDisabled}>
        {t("geography.points.relocate")}
      </button>
      <button
        type="button"
        disabled={form.write.isBusy}
        onClick={() => {
          void form.refresh();
        }}
      >
        {t("geography.editor.refresh")}
      </button>
    </>
  );
}
