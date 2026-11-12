import { Printer } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { Button } from "../ui/Button";
import type { LabelRecord } from "./label-record";
import { PrintLabelsDialog } from "./PrintLabelsDialog";

interface PrintLabelsButtonProps {
  records: readonly LabelRecord[];
  /** Button text; defaults to "Imprimir etiquetas". */
  labelKey?: MessageKey;
  variant?: "primary" | "secondary" | "tertiary";
}

/** "Imprimir etiquetas": opens the print dialog for the given records. Disabled with the reason when there are none. */
export function PrintLabelsButton({
  records,
  labelKey = "labels.action.print",
  variant = "tertiary",
}: PrintLabelsButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isEmpty = records.length === 0;
  return (
    <>
      <Button
        variant={variant}
        leadingIcon={<Printer aria-hidden="true" />}
        disabled={isEmpty}
        title={isEmpty ? t("labels.print.noRecords") : undefined}
        onClick={() => {
          setOpen(true);
        }}
      >
        {t(labelKey)}
      </Button>
      {open && <PrintLabelsDialog records={records} open onOpenChange={setOpen} />}
    </>
  );
}
