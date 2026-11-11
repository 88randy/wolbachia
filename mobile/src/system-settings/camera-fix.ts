import type { MessageKey } from "@wolbachia/i18n";
import type { InfoNoticeAction } from "../ui/InfoNotice.tsx";
import { openSystemSetting } from "./open-system-setting.ts";
import { requestCameraPermission } from "./request-permission.ts";

/** The inline button of a camera permission warning: ask again, or open the app settings. */
export function cameraFixAction(
  errorKey: MessageKey | null,
  t: (key: MessageKey) => string,
): InfoNoticeAction | undefined {
  if (errorKey === "mobile.camera.permissionDenied")
    return {
      label: t("mobile.global.fixAllowCamera"),
      onPress: () => {
        void requestCameraPermission();
      },
    };
  if (errorKey === "mobile.camera.permissionBlocked")
    return {
      label: t("mobile.global.fixOpenSettings"),
      onPress: () => {
        void openSystemSetting("app");
      },
    };
  return undefined;
}
