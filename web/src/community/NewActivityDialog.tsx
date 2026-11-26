import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Tooltip } from "../ui/Tooltip";
import { ActivityForm } from "./ActivityForm";

/** "New activity": the button and the dialog that holds the form. */
export function NewActivityDialog({ canCreate }: { canCreate: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  if (!canCreate)
    // Blocked but focusable: the reason shows on hover and on keyboard focus, not only on hover.
    return (
      <Tooltip content={t("community.noCreate")}>
        <Button aria-disabled leadingIcon={<Plus aria-hidden="true" />}>
          {t("community.create")}
        </Button>
      </Tooltip>
    );
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t("community.form.title")}
      description={t("community.form.description")}
      trigger={<Button leadingIcon={<Plus aria-hidden="true" />}>{t("community.create")}</Button>}
    >
      <ActivityForm onSaved={close} onCancel={close} />
    </Dialog>
  );
}
