import { useTranslation } from "react-i18next";
import { DialogFooter } from "../ui/DialogFooter";
import { Button } from "../ui/Button";
import { SupplyIdentityFields } from "./supplies/SupplyIdentityFields";
import { SupplyProtocolFields } from "./supplies/SupplyProtocolFields";
import { InventoryFormFeedback } from "./InventoryFormFeedback";
import { useInventoryForm } from "./use-inventory-form";
import type { InventoryKind, InventoryRecord } from "./inventory-links";
import type { InventoryFieldsProps } from "./inventory-form-types";
import styles from "./inventory.module.css";
import { LotIdentityFields } from "./lots/LotIdentityFields";
import { LotBiologicalFields } from "./lots/LotBiologicalFields";
import { LotScanFill } from "./lots/LotScanFill";
import { LotPlacementFields } from "./lots/LotPlacementFields";
import { LocationFields } from "./locations/LocationFields";
import { LotProtocolSummary } from "./lots/LotProtocolSummary";
import { Card } from "../ui/Card";
import { FormActions } from "../components/templates/FormGrid";
import { FormSection } from "../components/templates/FormSection";
import { InventoryFacts } from "./InventoryFacts";
interface Props {
  kind: InventoryKind;
  onCancel?: () => void;
  record?: InventoryRecord;
  isVerifying?: boolean;
  onSaved: (record: InventoryRecord) => void;
}
function Fields({ kind, fields }: { kind: InventoryKind; fields: InventoryFieldsProps }) {
  const { t } = useTranslation();
  if (kind === "supplies")
    return (
      <>
        <FormSection title={t("inventory.section.supplyData")}>
          <SupplyIdentityFields {...fields} />
        </FormSection>
        <SupplyProtocolFields {...fields} />
      </>
    );
  if (kind === "locations") return <LocationFields {...fields} />;
  return (
    <>
      {!fields.previous && <LotScanFill {...fields} />}
      <FormSection title={t("inventory.section.lotWhat")}>
        <LotIdentityFields {...fields} />
      </FormSection>
      <FormSection title={t("inventory.section.lotWhere")}>
        <LotPlacementFields {...fields} />
      </FormSection>
      <FormSection
        title={t("inventory.section.lotBiological")}
        description={t("inventory.section.lotBiologicalHint")}
      >
        <LotBiologicalFields {...fields} />
      </FormSection>
      <LotProtocolSummary {...fields} />
    </>
  );
}
export function InventoryForm(props: Props) {
  const form = useInventoryForm(props);
  const busy = form.isBusy || form.isChecking || props.isVerifying === true;
  const fields = fieldsOf(form, busy);
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit();
      }}
    >
      <FormRecovery form={form} record={props.record} busy={busy} />
      <Fields kind={props.kind} fields={fields} />
      <SubmitAction form={form} busy={busy} {...props} />
    </form>
  );
}
function FormRecovery({
  form,
  record,
  busy,
}: {
  form: ReturnType<typeof useInventoryForm>;
  record?: InventoryRecord;
  busy: boolean;
}) {
  return (
    <>
      <InventoryFormFeedback
        failure={form.failure}
        invalid={form.invalid}
        disabled={busy}
        onReview={form.review}
        onReconcile={() => {
          void form.reconcile();
        }}
      />
      {form.failure?.conflict && record && <ConflictFacts record={record} />}
    </>
  );
}
function ConflictFacts({ record }: { record: InventoryRecord }) {
  const { t } = useTranslation();
  return (
    <Card title={t("inventory.section.currentRecord")}>
      <p>
        {t("inventory.field.revision")}: {record.revision}
      </p>
      <InventoryFacts record={record} />
    </Card>
  );
}
function fieldsOf(form: ReturnType<typeof useInventoryForm>, busy: boolean) {
  return {
    values: form.values,
    previous: form.reviewed,
    setValue: form.setValue,
    disabled: busy || form.failure?.uncertain === true,
  };
}
function SubmitAction({
  form,
  busy,
  record,
  kind,
  onCancel,
}: Props & { form: ReturnType<typeof useInventoryForm>; busy: boolean }) {
  const { t } = useTranslation();
  const key = record
    ? "inventory.action.save"
    : kind === "lots"
      ? "inventory.action.draft"
      : "inventory.action.create";
  const disabled = busy || form.cooling || form.failure?.conflict || form.failure?.uncertain;
  const submit = (
    <Button type="submit" loading={form.isBusy} aria-disabled={disabled}>
      {t(key)}
    </Button>
  );
  if (!onCancel) return <FormActions>{submit}</FormActions>;
  return (
    <DialogFooter>
      <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
        {t("common.actions.cancel")}
      </Button>
      {submit}
    </DialogFooter>
  );
}
