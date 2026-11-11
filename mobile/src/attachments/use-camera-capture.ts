import type { MessageKey } from "@wolbachia/i18n";
import { useCameraPermissions } from "expo-camera";
import type { CameraView } from "expo-camera";
import { useEffect, useState } from "react";
import type { RefObject } from "react";

/** Picture quality: 0.6 keeps a field photo far below the upload limit and still readable. */
export const PHOTO_QUALITY = 0.6;

type Permission = ReturnType<typeof useCameraPermissions>[0];

function permissionKey(permission: Permission): MessageKey | null {
  if (permission === null || permission.granted) return null;
  return permission.canAskAgain
    ? "mobile.camera.permissionDenied"
    : "mobile.camera.permissionBlocked";
}

async function takePicture(view: CameraView): Promise<string> {
  const picture = await view.takePictureAsync({
    quality: PHOTO_QUALITY,
    exif: false,
    base64: false,
  });
  return picture.uri;
}

function useShutter(view: RefObject<CameraView | null>) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [hasFailed, setFailed] = useState(false);
  const shoot = async () => {
    if (isBusy || !view.current) return;
    setBusy(true);
    try {
      setPhoto(await takePicture(view.current));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const retake = () => {
    setPhoto(null);
    setFailed(false);
  };
  return {
    photo,
    isBusy,
    hasFailed,
    shoot,
    retake,
    fail: () => {
      setFailed(true);
    },
  };
}

/** Permission, shutter and keep-or-retake state of the in-app camera. No business rules here. */
export function useCameraCapture(view: RefObject<CameraView | null>) {
  const [permission, request] = useCameraPermissions();
  const [isReady, setReady] = useState(false);
  const shutter = useShutter(view);
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void request();
  }, [permission, request]);
  return {
    ...shutter,
    isReady,
    isPermitted: permission?.granted === true,
    permissionKey: permissionKey(permission),
    errorKey: shutter.hasFailed ? ("mobile.camera.failed" as const) : permissionKey(permission),
    markReady: () => {
      setReady(true);
    },
  };
}

export type CameraCaptureModel = ReturnType<typeof useCameraCapture>;
