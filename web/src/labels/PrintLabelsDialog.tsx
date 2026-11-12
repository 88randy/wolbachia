import * as Primitive from "@radix-ui/react-dialog";
import { Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { FormField, FormGrid } from "../components/templates/FormGrid";
import { TextField } from "../forms/TextField";
import { Button } from "../ui/Button";
import { DialogHeader } from "../ui/DialogHeader";
import { InlineNotice } from "../ui/InlineNotice";
import { SelectMenu } from "../ui/SelectMenu";
import { DIALOG_CLASS, DIALOG_DESCRIPTION_CLASS, OVERLAY_CLASS } from "../ui/overlay-classes";
import { LABEL_FORMATS, LABEL_FORMAT_SPECS, MAX_COPIES, MAX_LABELS } from "./label-formats";
import type { LabelFormat } from "./label-formats";
import type { LabelRecord } from "./label-record";
import { LabelPrintPortal } from "./LabelPrintPortal";
import { LabelSheet } from "./LabelSheet";
import { useLabelOptions } from "./use-label-options";

const DIALOG_WIDTH = "w-[min(calc(100vw-2rem),44rem)]";

type Model = ReturnType<typeof useLabelOptions>;

export interface PrintLabelsDialogProps {
  records: readonly LabelRecord[];
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

function FormatField({ model }: { model: Model }) {
  const { t } = useTranslation();
  const options = LABEL_FORMATS.map((id) => ({
    value: id,
    label: t(LABEL_FORMAT_SPECS[id].labelKey),
  }));
  return (
    <FormField>
      <label htmlFor="label-format" className="mb-1 block text-[13px] font-semibold text-ink">
        {t("labels.format.field")}
      </label>
      <SelectMenu
        id="label-format"
        value={model.format}
        options={options}
        onValueChange={(value) => {
          model.chooseFormat(value as LabelFormat);
        }}
      />
      <p className="m-0 mt-1 text-xs text-ink-3">{t("labels.format.hint")}</p>
    </FormField>
  );
}

function CopiesField({ model }: { model: Model }) {
  const { t } = useTranslation();
  return (
    <FormField width="short">
      <TextField
        id="label-copies"
        label={t("labels.copies.field")}
        hint={t("labels.copies.hint", { max: MAX_COPIES })}
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_COPIES}
        value={model.copiesText}
        onChange={(event) => {
          model.changeCopies(event.target.value);
        }}
      />
    </FormField>
  );
}

function Summary({ count, model }: { count: number; model: Model }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[13px] text-ink-2" role="status">
        {t("labels.dialog.count", { count })}
        {" · "}
        {t("labels.dialog.total", { count: model.plan.labels.length })}
      </p>
      {model.plan.isTruncated && (
        <InlineNotice tone="warning">
          {t("labels.dialog.tooMany", { count: MAX_LABELS })}
        </InlineNotice>
      )}
    </div>
  );
}

function Preview({ model }: { model: Model }) {
  const { t } = useTranslation();
  return (
    <section aria-label={t("labels.preview.title")} className="flex flex-col gap-1">
      <p className="m-0 text-xs text-ink-3">{t("labels.preview.hint")}</p>
      <div className="max-h-64 overflow-auto rounded-lg bg-surface-muted p-3">
        <LabelSheet format={model.format} labels={model.plan.labels} mode="preview" />
      </div>
    </section>
  );
}

function Footer({ hasLabels, onClose }: { hasLabels: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
      <Button variant="secondary" onClick={onClose}>
        {t("common.actions.close")}
      </Button>
      <Button
        leadingIcon={<Printer aria-hidden="true" />}
        disabled={!hasLabels}
        title={hasLabels ? undefined : t("labels.print.noRecords")}
        onClick={() => {
          window.print();
        }}
      >
        {t("labels.print.button")}
      </Button>
    </div>
  );
}

function Body({ records, onClose }: { records: readonly LabelRecord[]; onClose: () => void }) {
  const { t } = useTranslation();
  const model = useLabelOptions(records);
  const hasLabels = model.plan.labels.length > 0;
  return (
    <>
      <FormGrid>
        <FormatField model={model} />
        <CopiesField model={model} />
      </FormGrid>
      <Summary count={records.length} model={model} />
      <Preview model={model} />
      <p className="m-0 text-xs text-ink-3">{t("labels.print.help")}</p>
      <Footer hasLabels={hasLabels} onClose={onClose} />
      {hasLabels && <LabelPrintPortal format={model.format} labels={model.plan.labels} />}
    </>
  );
}

/**
 * Choose the label format and copies, see the labels, and print. Controlled so a list row, a
 * toolbar button and a record page can all open it.
 */
export function PrintLabelsDialog({ records, open, onOpenChange }: PrintLabelsDialogProps) {
  const { t } = useTranslation();
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className={OVERLAY_CLASS} />
        <Primitive.Content className={cn(DIALOG_CLASS, DIALOG_WIDTH)}>
          <DialogHeader title={t("labels.dialog.title")} />
          <Primitive.Description className={DIALOG_DESCRIPTION_CLASS}>
            {t("labels.dialog.description")}
          </Primitive.Description>
          <Body
            records={records}
            onClose={() => {
              onOpenChange(false);
            }}
          />
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
