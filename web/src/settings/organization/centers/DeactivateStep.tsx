import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DetailSection } from "../../../components/templates/DetailSection";
import { FormActions } from "../../../components/templates/FormGrid";
import { TextField } from "../../../forms/TextField";
import { Button } from "../../../ui/Button";
import { InlineNotice } from "../../../ui/InlineNotice";
import { blockersOf, errorKeyOf, reasonKeyOf } from "./centers-api";
import type { CloseFlow } from "./use-close-flow";
import { useDeactivateCenter } from "./use-deactivate-center";

const REASON_MIN_LENGTH = 5;

function Refusal({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const blockers = blockersOf(error);
  if (blockers.length === 0)
    return <InlineNotice tone="critical">{t(errorKeyOf(error))}</InlineNotice>;
  return (
    <InlineNotice tone="critical">
      <p>{t("centersAdmin.close.blocked")}</p>
      <ul className="m-0 pl-4">
        {blockers.map((row) => (
          <li key={row.reason}>{t(reasonKeyOf(row.reason), row.params ?? {})}</li>
        ))}
      </ul>
    </InlineNotice>
  );
}

function ReasonField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <TextField
      id="center-close-reason"
      label={t("centersAdmin.close.reason")}
      hint={t("centersAdmin.close.reasonHint")}
      value={value}
      maxLength={500}
      required
      disabled={disabled}
      onChange={(event) => {
        onChange(event.currentTarget.value);
      }}
    />
  );
}

function SubmitButton({ disabled, loading }: { disabled: boolean; loading: boolean }) {
  const { t } = useTranslation();
  return (
    <Button type="submit" variant="destructive" disabled={disabled} loading={loading}>
      {t("centersAdmin.action.deactivate")}
    </Button>
  );
}

/** The last step: enabled only when every blocking row is ready; the reason is required. */
export function DeactivateStep({ flow }: { flow: CloseFlow }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const deactivate = useDeactivateCenter(flow.center);
  const isReady = flow.blockingTotal > 0 && flow.readyCount === flow.blockingTotal;
  const isValid = reason.trim().length >= REASON_MIN_LENGTH;
  return (
    <DetailSection title={t("centersAdmin.close.final")} hint={t("centersAdmin.close.finalHint")}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (isReady && isValid) deactivate.mutate(reason.trim());
        }}
      >
        <ReasonField value={reason} onChange={setReason} disabled={!isReady} />
        {deactivate.isError && <Refusal error={deactivate.error} />}
        <FormActions>
          <SubmitButton disabled={!isReady || !isValid} loading={deactivate.isPending} />
        </FormActions>
      </form>
    </DetailSection>
  );
}
