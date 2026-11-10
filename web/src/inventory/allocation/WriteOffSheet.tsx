import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { SideSheet } from "../../ui/SideSheet";
import { WriteOffForm } from "./WriteOffForm";
import { useWriteOffForm } from "./use-write-off-form";
import type { WriteOffKind } from "./use-write-off-form";
import type { AllocationScope } from "./allocation-query";

function SheetBody(props: {
  scope: AllocationScope;
  route: string;
  kind: WriteOffKind;
  onClose: () => void;
}) {
  const form = useWriteOffForm(props.scope, props.route, props.kind);
  return <WriteOffForm scope={props.scope} form={form} onClose={props.onClose} />;
}

/** The form lives in a side sheet that traps focus and returns it to the trigger on close. */
export function WriteOffSheet(props: {
  scope: AllocationScope;
  route: string;
  kind: WriteOffKind;
}) {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);
  return (
    <SideSheet
      open={isOpen}
      onOpenChange={setOpen}
      title={t("allocation.writeOff.formTitle")}
      description={t("allocation.writeOff.formDescription")}
      trigger={
        <Button leadingIcon={<Plus aria-hidden="true" />}>{t("allocation.writeOff.open")}</Button>
      }
    >
      <SheetBody
        {...props}
        onClose={() => {
          setOpen(false);
        }}
      />
    </SideSheet>
  );
}
