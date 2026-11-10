import { useTranslation } from "react-i18next";
import { MapPointPicker } from "../../map-picker/MapPointPicker";
import { parseLocation } from "./geometry";
import { usePointRelocation } from "./use-point-relocation";
import type { RelocationOptions } from "./use-point-relocation";
import { RelocationFeedback } from "./RelocationFeedback";
import { RelocationControls } from "./RelocationControls";
export function PointRelocationForm(options: RelocationOptions) {
  const { t } = useTranslation();
  const form = usePointRelocation(options);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.send();
      }}
    >
      <MapPointPicker
        label={t("geography.field.location")}
        value={parseLocation(form.text)}
        onChange={(location) => {
          if (!form.write.isBusy) form.setText(location.join(","));
        }}
      />
      <RelocationControls form={form} />
      <RelocationFeedback form={form} />
    </form>
  );
}
