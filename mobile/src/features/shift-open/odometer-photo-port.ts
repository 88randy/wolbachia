import * as ImagePicker from "expo-image-picker";
import { cameraBroker } from "../../attachments/camera-broker.ts";
import type { PhotoCapturePort } from "./domain.ts";

/** Opens the in-app camera for the odometer photo. Cancelling or denying never blocks the draft. */
export const cameraPhotoPort: PhotoCapturePort = {
  async capture() {
    try {
      let permission = await ImagePicker.getCameraPermissionsAsync();
      if (!permission.granted && permission.canAskAgain)
        permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return { status: "unavailable" };
      const fileRef = await cameraBroker.request();
      return fileRef === null ? { status: "cancelled" } : { status: "captured", fileRef };
    } catch {
      return { status: "unavailable" };
    }
  },
};
