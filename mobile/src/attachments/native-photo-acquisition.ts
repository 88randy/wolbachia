import * as picker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import { CameraError, createPhotoAcquisitionPort } from "./photo-acquisition.ts";
import type { EvidencePort } from "../features/ovitrap-check/types.ts";

export function createNativePhotoAcquisition(canStart: () => boolean): EvidencePort {
  if (Platform.OS !== "android")
    return { capture: () => Promise.reject(new CameraError("camera_unavailable")) };
  return createPhotoAcquisitionPort({ picker, uuid: randomUUID, canStart });
}
