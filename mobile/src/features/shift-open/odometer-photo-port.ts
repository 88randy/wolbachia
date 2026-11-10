import * as ImagePicker from "expo-image-picker";
import type { PhotoCapturePort } from "./domain.ts";

/** Opens the phone camera for the odometer photo. Cancelling or denying never blocks the draft. */
export const cameraPhotoPort: PhotoCapturePort = {
  async capture() {
    try {
      let permission = await ImagePicker.getCameraPermissionsAsync();
      if (!permission.granted && permission.canAskAgain)
        permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return { status: "unavailable" };
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        exif: false,
        quality: 0.7,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      return asset === undefined
        ? { status: "cancelled" }
        : { status: "captured", fileRef: asset.uri };
    } catch {
      return { status: "unavailable" };
    }
  },
};
