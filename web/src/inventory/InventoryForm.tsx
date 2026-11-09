import { useTranslation } from "react-i18next";
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
import { LotPlacementFields } from "./lots/LotPlacementFields";
import { LocationFields } from "./locations/LocationFields";
import { LotProtocolSummary } from "./lots/LotProtocolSummary";
import { Card } from "../ui/Card";
import { InventoryFacts } from "./InventoryFacts";
interface Props {
  kind: InventoryKind;
  record?: InventoryRecord;
  isVerifying?: boolean;
  onSaved: (record: InventoryRecord) => void;
}
function Fields({ kind, fields }: { kind: InventoryKind; fields: InventoryFieldsProps }) {
  if (kind === "supplies")
    return (
      <>
        <SupplyIdentityFields {...fields} />
        <SupplyProtocolFields {...fields} />
      </>
    );
  if (kind === "locations") return <LocationFields {...fields} />;
  return (
    <>
      <LotIdentityFields {...fields} />
      <LotBiologicalFields {...fields} />
      <LotPlacementFields {...fields} />
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
}: Props & { form: ReturnType<typeof useInventoryForm>; busy: boolean }) {
  const { t } = useTranslation();
  const key = record
    ? "inventory.action.save"
    : kind === "lots"
      ? "inventory.action.draft"
      : "inventory.action.create";
  const disabled = busy || form.cooling || form.failure?.conflict || form.failure?.uncertain;
  return (
    <Button type="submit" loading={form.isBusy} aria-disabled={disabled}>
      {t(key)}
    </Button>
  );
}
