import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { InterventionForm } from "./InterventionForm";

/** The "Registrar intervención" button and the form it opens. */
export function NewInterventionDialog({
  variant = "primary",
}: {
  variant?: "primary" | "secondary";
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Dialog
      open={isOpen}
      onOpenChange={setIsOpen}
      title={t("scheduling.intervention.new")}
      description={t("scheduling.intervention.newHint")}
      trigger={
        <Button variant={variant} leadingIcon={<Plus aria-hidden="true" />}>
          {t("scheduling.intervention.new")}
        </Button>
      }
    >
      <InterventionForm
        onDone={() => {
          setIsOpen(false);
        }}
      />
    </Dialog>
  );
}
