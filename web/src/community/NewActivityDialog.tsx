import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { ActivityForm } from "./ActivityForm";

/** "New activity": the button and the dialog that holds the form. */
export function NewActivityDialog({ canCreate }: { canCreate: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t("community.form.title")}
      description={t("community.form.description")}
      trigger={
        <Button
          disabled={!canCreate}
          title={canCreate ? undefined : t("community.noCreate")}
          leadingIcon={<Plus aria-hidden="true" />}
        >
          {t("community.create")}
        </Button>
      }
    >
      <ActivityForm onSaved={close} onCancel={close} />
    </Dialog>
  );
}
