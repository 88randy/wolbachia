import { Modal } from "react-native";
import { useSyncExternalStore } from "react";
import { cameraBroker } from "./camera-broker.ts";
import { CameraCaptureScreen } from "./CameraCaptureScreen.tsx";

/** Always mounted once in the app shell: shows the camera only while a photo is requested. */
export function InAppCameraHost() {
  const isOpen = useSyncExternalStore(cameraBroker.subscribe, cameraBroker.isOpen);
  if (!isOpen) return null;
  return (
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        cameraBroker.settle(null);
      }}
    >
      <CameraCaptureScreen onDone={cameraBroker.settle} />
    </Modal>
  );
}
