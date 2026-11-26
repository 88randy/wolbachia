/** Why the camera could not start, in terms the person can act on. */
export type CameraFailure = "denied" | "unavailable" | "failed";

/** The rear camera is preferred (tablets); a device with one camera still opens it. */
const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

/** Whether this browser can open a camera at all (needs HTTPS or localhost). */
export function canUseCamera(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/** True unless the browser reports that the device has no video input. */
export async function hasVideoInput(): Promise<boolean> {
  if (!canUseCamera() || typeof navigator.mediaDevices.enumerateDevices !== "function") {
    return canUseCamera();
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((device) => device.kind === "videoinput");
  } catch {
    return true;
  }
}

export function classifyCameraError(error: unknown): CameraFailure {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "unavailable";
  return "failed";
}

export function openCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia(CONSTRAINTS);
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

export function supportsTorch(track: MediaStreamTrack | undefined): boolean {
  // `torch` is not in the DOM typings yet; the browser lists it when the camera has a light.
  const capabilities = track?.getCapabilities() as { torch?: boolean } | undefined;
  return capabilities?.torch === true;
}

export async function setTorch(track: MediaStreamTrack, isOn: boolean): Promise<void> {
  await track.applyConstraints({ advanced: [{ torch: isOn } as MediaTrackConstraintSet] });
}
