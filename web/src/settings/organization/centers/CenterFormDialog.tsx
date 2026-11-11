import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FormActions } from "../../../components/templates/FormGrid";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import type { CenterRow } from "./centers-api";
import { CenterFormFields } from "./CenterFormFields";
import { useCenterForm } from "./use-center-form";

interface CenterFormDialogProps {
  trigger: ReactNode;
  center?: CenterRow | undefined;
  /** Controlled open state (opened from a row menu); uncontrolled when omitted. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** "Nuevo centro" or "Editar centro": a short dialog with one primary button. */
export function CenterFormDialog({ trigger, center, ...control }: CenterFormDialogProps) {
  const { t } = useTranslation();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = control.open ?? ownOpen;
  const setOpen = control.onOpenChange ?? setOwnOpen;
  return (
    <Dialog
      trigger={trigger}
      title={t(center ? "centersAdmin.form.editTitle" : "centersAdmin.form.title")}
      description={t("centersAdmin.form.timezoneNote")}
      open={open}
      onOpenChange={setOpen}
    >
      {open && (
        <CenterForm
          center={center}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </Dialog>
  );
}

function CenterForm({ center, onClose }: { center: CenterRow | undefined; onClose: () => void }) {
  const { t } = useTranslation();
  const form = useCenterForm(center, onClose);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        form.submit();
      }}
    >
      <CenterFormFields form={form} isEdit={center !== undefined} />
      <FormActions>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("common.actions.cancel")}
        </Button>
        <Button type="submit" loading={form.isPending}>
          {t(center ? "centersAdmin.form.save" : "centersAdmin.form.create")}
        </Button>
      </FormActions>
    </form>
  );
}
