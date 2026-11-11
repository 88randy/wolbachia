import * as ImagePicker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import { cameraBroker } from "./camera-broker.ts";
import { createInAppCameraPicker } from "./in-app-camera-picker.ts";
import { CameraError, createPhotoAcquisitionPort } from "./photo-acquisition.ts";
import type { EvidencePort } from "../features/ovitrap-check/types.ts";

export function createNativePhotoAcquisition(canStart: () => boolean): EvidencePort {
  if (Platform.OS !== "android")
    return { capture: () => Promise.reject(new CameraError("camera_unavailable")) };
  return createPhotoAcquisitionPort({
    picker: createInAppCameraPicker(cameraBroker, ImagePicker),
    uuid: randomUUID,
    canStart,
  });
}
