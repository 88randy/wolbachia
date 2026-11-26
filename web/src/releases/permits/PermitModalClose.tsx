import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";

/** The "X" of a permit dialog's header; a pending submit keeps it from closing. */
export function PermitModalClose({ isBusy, onClose }: { isBusy: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-mt-1 -mr-2 px-2"
      aria-label={t("common.actions.close")}
      aria-disabled={isBusy}
      onClick={() => {
        if (!isBusy) onClose();
      }}
    >
      <X aria-hidden="true" strokeWidth={1.75} />
    </Button>
  );
}
