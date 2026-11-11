/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../forms/TextField";
import { Button } from "../ui/Button";
import { DialogFooter } from "../ui/DialogFooter";
import { ModalDialog } from "../ui/ModalDialog";
import { useVoidLimits } from "../void";

interface DeactivateDialogProps {
  name: string;
  isBusy: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** Deactivation asks for the reason (void-reason rule); the server's length check still wins. */
export function DeactivateDialog({ name, isBusy, onConfirm, onClose }: DeactivateDialogProps) {
  const { t } = useTranslation();
  const limits = useVoidLimits();
  const id = useId();
  const [reason, setReason] = useState("");
  const isShort = reason.trim().length < limits.minLength;
  return (
    <ModalDialog title={t("users.deactivate.title", { name })} onClose={onClose} isBusy={isBusy}>
      <p className="m-0 text-sm text-ink-2">{t("users.deactivate.consequence")}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isShort) onConfirm(reason.trim());
        }}
      >
        <TextField
          id={id}
          label={t("users.deactivate.reasonLabel")}
          required
          minLength={limits.minLength}
          maxLength={limits.maxLength}
          value={reason}
          hint={t("users.deactivate.reasonHint", { count: limits.minLength })}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
        <DialogFooter>
          <Button type="button" variant="tertiary" disabled={isBusy} onClick={onClose}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" variant="destructive" loading={isBusy} disabled={isShort}>
            {t("users.deactivate.confirm")}
          </Button>
        </DialogFooter>
      </form>
    </ModalDialog>
  );
}
