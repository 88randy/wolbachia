import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { Button } from "../../ui/Button.tsx";

export function SampleButton() {
  const t = useT();
  const { push } = useNavigation();
  return (
    <Button
      label={t("mobile.sample.title")}
      variant="outline"
      onPress={() => {
        push({ name: "sampleCapture", sampleId: null, sourceRef: null, manualCapture: true });
      }}
    />
  );
}
