import type * as ImagePicker from "expo-image-picker";
import type { EvidenceCaptureContext, EvidencePort } from "../features/ovitrap-check/types.ts";
import { EvidenceError, MAX_EVIDENCE_BYTES } from "./types.ts";

export type CameraPermission = Pick<
  ImagePicker.CameraPermissionResponse,
  "granted" | "canAskAgain"
>;
export interface CameraPicker extends Pick<
  typeof ImagePicker,
  "getPendingResultAsync" | "launchCameraAsync"
> {
  getCameraPermissionsAsync(): Promise<CameraPermission>;
  requestCameraPermissionsAsync(): Promise<CameraPermission>;
}
export type CameraErrorCode =
  | "camera_permission_denied"
  | "camera_permission_blocked"
  | "camera_unavailable"
  | "camera_result_invalid"
  | "camera_busy"
  | "camera_unlock_required";
export class CameraError extends Error {
  readonly code: CameraErrorCode;
  constructor(code: CameraErrorCode) {
    super(code);
    this.code = code;
    this.name = "CameraError";
  }
}
interface Input {
  readonly picker: CameraPicker;
  readonly uuid: () => string;
  readonly canStart: () => boolean;
}
/** Native promises cannot be cancelled; their single-flight lease lasts until they settle. */
class PhotoAcquisition implements EvidencePort {
  readonly input: Input;
  #isBusy = false;
  #hasReadPending = false;
  constructor(input: Input) {
    this.input = input;
  }
  async capture(context: EvidenceCaptureContext) {
    if (this.#isBusy) throw new CameraError("camera_busy");
    this.#isBusy = true;
    try {
      return await this.#acquire(context);
    } finally {
      this.#isBusy = false;
    }
  }
  #requireUnlocked(): void {
    if (!this.input.canStart()) throw new CameraError("camera_unlock_required");
  }
  async #discardPending(): Promise<void> {
    if (this.#hasReadPending) return;
    // A cold result has no proven actor/session/draft correlation. Never adopt it.
    await nativeCall(() => this.input.picker.getPendingResultAsync());
    this.#hasReadPending = true;
  }
  async #acquire(context: EvidenceCaptureContext) {
    await context.assertCurrent();
    this.#requireUnlocked();
    await this.#discardPending();
    await context.assertCurrent();
    await requirePermission(this.input.picker, context);
    await context.assertCurrent();
    this.#requireUnlocked();
    const id = this.input.uuid();
    const result = await nativeCall(() =>
      this.input.picker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        base64: false,
        exif: false,
        quality: 1,
      }),
    );
    await context.assertCurrent();
    const fileRef = cameraFile(result);
    return fileRef === null ? null : { id, fileRef };
  }
}
async function nativeCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new CameraError("camera_unavailable");
  }
}
async function requirePermission(picker: CameraPicker, context: EvidenceCaptureContext) {
  let permission = await nativeCall(() => picker.getCameraPermissionsAsync());
  await context.assertCurrent();
  if (!permission.granted && permission.canAskAgain) {
    permission = await nativeCall(() => picker.requestCameraPermissionsAsync());
    await context.assertCurrent();
  }
  if (!permission.granted)
    throw new CameraError(
      permission.canAskAgain ? "camera_permission_denied" : "camera_permission_blocked",
    );
}
function cameraFile(result: ImagePicker.ImagePickerResult): string | null {
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (
    result.assets.length !== 1 ||
    !asset ||
    !asset.uri.startsWith("file://") ||
    asset.uri.length <= 7
  )
    throw new CameraError("camera_result_invalid");
  validateAsset(asset);
  return asset.uri;
}
function validateAsset(asset: ImagePicker.ImagePickerAsset): void {
  if (
    (asset.type && asset.type !== "image") ||
    (asset.mimeType && !["image/jpeg", "image/png"].includes(asset.mimeType))
  )
    throw new EvidenceError("file_type");
  if (
    asset.fileSize !== undefined &&
    (!Number.isFinite(asset.fileSize) || asset.fileSize <= 0 || asset.fileSize > MAX_EVIDENCE_BYTES)
  )
    throw new EvidenceError("file_size");
}
export function createPhotoAcquisitionPort(input: Input): EvidencePort {
  return new PhotoAcquisition(input);
}
