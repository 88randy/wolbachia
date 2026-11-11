import { Camera, Settings } from "lucide-react-native";
import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../i18n/I18nProvider.tsx";
import { SecondaryButton } from "../ui/SecondaryButton.tsx";
import { openSystemSetting } from "./open-system-setting.ts";
import { requestCameraPermission } from "./request-permission.ts";

/** Camera warnings end with a button: ask again when allowed, otherwise open the app settings. */
export function CameraPermissionFix({ errorKey }: { readonly errorKey: MessageKey | null }) {
  const t = useT();
  if (errorKey === "mobile.camera.permissionDenied") {
    return (
      <SecondaryButton
        icon={Camera}
        label={t("mobile.global.fixAllowCamera")}
        onPress={() => {
          void requestCameraPermission();
        }}
      />
    );
  }
  if (errorKey !== "mobile.camera.permissionBlocked") return null;
  return (
    <SecondaryButton
      icon={Settings}
      label={t("mobile.global.fixOpenSettings")}
      onPress={() => {
        void openSystemSetting("app");
      }}
    />
  );
}
