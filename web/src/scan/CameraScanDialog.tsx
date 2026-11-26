import { Flashlight, FlashlightOff } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { Button } from "../ui/Button";
import { DialogFooter } from "../ui/DialogFooter";
import { ModalDialog } from "../ui/ModalDialog";
import { useCameraScanner } from "./use-camera-scanner";
import type { CameraStatus } from "./use-camera-scanner";

const STATUS_KEYS: Record<CameraStatus, MessageKey> = {
  starting: "scan.camera.starting",
  scanning: "scan.camera.scanning",
  denied: "scan.camera.denied",
  unavailable: "scan.camera.unavailable",
  failed: "scan.camera.failed",
};

interface CameraScanDialogProps {
  /** Called once with the text of the first code the camera reads. */
  onCode: (code: string) => void;
  onClose: () => void;
}

/**
 * A modal with the device camera. The page behind is inert and Tab stays inside (native modal
 * dialog); Escape closes it. The result is announced by the field that opened it.
 */
export function CameraScanDialog({ onCode, onClose }: CameraScanDialogProps) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const camera = useCameraScanner(onCode, attempt);
  const isFailure = !["starting", "scanning"].includes(camera.status);
  return (
    <ModalDialog title={t("scan.camera.title")} onClose={onClose} isWide>
      <p className="m-0 mb-3 text-sm text-ink-2">{t("scan.camera.hint")}</p>
      <video
        ref={camera.videoRef}
        muted
        playsInline
        aria-label={t("scan.camera.videoLabel")}
        hidden={isFailure}
        className="aspect-[4/3] max-h-[60vh] w-full rounded-xl bg-ink object-cover"
      />
      <div aria-live="polite" className="mt-3 min-h-6 text-sm text-ink">
        {t(STATUS_KEYS[camera.status])}
      </div>
      <DialogFooter>
        {camera.canTorch && (
          <Button
            variant="secondary"
            aria-pressed={camera.isTorchOn}
            leadingIcon={
              camera.isTorchOn ? <FlashlightOff aria-hidden /> : <Flashlight aria-hidden />
            }
            onClick={() => void camera.toggleTorch()}
          >
            {t(camera.isTorchOn ? "scan.camera.torchOff" : "scan.camera.torchOn")}
          </Button>
        )}
        {isFailure && camera.status !== "unavailable" && (
          <Button
            onClick={() => {
              setAttempt((current) => current + 1);
            }}
          >
            {t("scan.camera.retry")}
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          {t("scan.camera.close")}
        </Button>
      </DialogFooter>
    </ModalDialog>
  );
}
