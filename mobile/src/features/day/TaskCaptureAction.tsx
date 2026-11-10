import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import type { AssignedTask } from "./types.ts";

export function TaskCaptureAction({ task }: { readonly task: AssignedTask }) {
  const t = useT(),
    { push } = useNavigation();
  if (task.action !== "release") return <AppText>{t("mobile.day.scanHint")}</AppText>;
  return (
    <Button
      label={t("mobile.release.title")}
      onPress={() => {
        push({ name: "releaseCapture", taskId: task.id, deviceId: null, manualCapture: true });
      }}
    />
  );
}
