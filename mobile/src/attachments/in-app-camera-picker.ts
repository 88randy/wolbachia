import type { CameraBroker } from "./camera-broker.ts";
import type { CameraPicker } from "./photo-acquisition.ts";

type Permissions = Pick<
  CameraPicker,
  "getCameraPermissionsAsync" | "requestCameraPermissionsAsync"
>;

/**
 * Same contract as the system picker, but the photo is taken inside the app (CameraView). This
 * works on dedicated phones that have no camera app, and never opens the gallery.
 */
export function createInAppCameraPicker(
  broker: CameraBroker,
  permissions: Permissions,
): CameraPicker {
  return {
    getCameraPermissionsAsync: () => permissions.getCameraPermissionsAsync(),
    requestCameraPermissionsAsync: () => permissions.requestCameraPermissionsAsync(),
    // The in-app camera keeps no result across a process death; a cold result is never adopted.
    getPendingResultAsync: () => Promise.resolve(null),
    launchCameraAsync: async () => {
      const uri = await broker.request();
      if (uri === null) return { canceled: true, assets: null };
      return {
        canceled: false,
        assets: [{ uri, width: 0, height: 0, type: "image", mimeType: "image/jpeg" }],
      };
    },
  };
}
