/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { Button } from "../../ui/Button";
import { SelectMenu } from "../../ui/SelectMenu";
import { FormDialog } from "../FormDialog";
import { centersOptions, quadrantsOfCenterOptions } from "../reg-queries";
import { DateRangeField } from "../toolbar/DateRangeField";
import { endOfDayInstant, startOfDayInstant } from "../toolbar/date-range";
import { useRegAction } from "../use-reg-action";
import { useRegScope } from "../use-reg-list";

interface Draft {
  institution: string;
  center: string;
  quadrant: string;
  from: string | undefined;
  to: string | undefined;
  reference: string;
}

const EMPTY: Draft = {
  institution: "",
  center: "",
  quadrant: "",
  from: undefined,
  to: undefined,
  reference: "",
};

/** New authorization: every record is picked by name, the validity with a calendar. */
export function TransferCreateDialog() {
  const { t } = useTranslation();
  const scope = useRegScope();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const centers = useQuery(centersOptions(scope));
  const quadrants = useQuery({
    ...quadrantsOfCenterOptions(scope, draft.center),
    enabled: draft.center !== "",
  });
  const patch = (next: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };
  const validFrom = draft.from === undefined ? undefined : startOfDayInstant(draft.from);
  const validUntil = endOfDayInstant(draft.to ?? draft.from ?? "");
  const canSubmit =
    draft.institution.trim() !== "" &&
    draft.center !== "" &&
    draft.reference.trim() !== "" &&
    validFrom !== undefined &&
    validUntil !== undefined;
  const action = useRegAction({
    successKey: "regulatory.transfers.created",
    run: async (_input: null, signal) =>
      unwrap(
        await scope.client.POST("/api/v1/data-transfers/", {
          body: {
            recipient_institution: draft.institution.trim(),
            center_id: draft.center,
            quadrant_id: draft.quadrant === "" ? null : draft.quadrant,
            valid_from: validFrom ?? "",
            valid_until: validUntil ?? "",
            reference: draft.reference.trim(),
            fields: ["rfc"],
          },
          signal,
        }),
      ),
  });
  return (
    <FormDialog
      trigger={
        <Button leadingIcon={<Plus aria-hidden="true" />}>{t("regulatory.transfers.new")}</Button>
      }
      title={t("regulatory.transfers.new")}
      description={t("regulatory.transfers.newDescription")}
      submitLabel={t("regulatory.transfers.form.submit")}
      canSubmit={canSubmit}
      isBusy={action.isBusy}
      hasFailed={action.hasFailed}
      onReset={() => {
        setDraft(EMPTY);
        action.reset();
      }}
      onSubmit={(close) => {
        action.submit(null, close);
      }}
    >
      <TextField
        id="transfer-institution"
        label={t("regulatory.transfers.form.institution")}
        value={draft.institution}
        maxLength={200}
        required
        onChange={(event) => {
          patch({ institution: event.target.value });
        }}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="transfer-center" className="text-xs font-semibold text-ink-2">
          {t("regulatory.transfers.form.center")}
        </label>
        <SelectMenu
          id="transfer-center"
          value={draft.center}
          placeholder={t("regulatory.transfers.form.centerPlaceholder")}
          options={(centers.data?.results ?? []).map((center) => ({
            value: center.id,
            label: center.name,
          }))}
          onValueChange={(center) => {
            patch({ center, quadrant: "" });
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="transfer-quadrant" className="text-xs font-semibold text-ink-2">
          {t("regulatory.transfers.form.quadrant")}
        </label>
        <SelectMenu
          id="transfer-quadrant"
          value={draft.quadrant}
          disabled={draft.center === ""}
          placeholder={t("regulatory.transfers.form.quadrantPlaceholder")}
          options={[
            { value: "", label: t("regulatory.transfers.form.quadrantPlaceholder") },
            ...(quadrants.data?.results ?? []).map((quadrant) => ({
              value: quadrant.id,
              label: quadrant.code,
            })),
          ]}
          onValueChange={(quadrant) => {
            patch({ quadrant });
          }}
        />
      </div>
      <DateRangeField
        label={t("regulatory.transfers.form.validity")}
        from={draft.from}
        to={draft.to}
        onChange={(range) => {
          patch(range);
        }}
      />
      <TextField
        id="transfer-reference"
        label={t("regulatory.transfers.form.reference")}
        hint={t("regulatory.transfers.form.referenceHint")}
        value={draft.reference}
        maxLength={1000}
        required
        onChange={(event) => {
          patch({ reference: event.target.value });
        }}
      />
      <label className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <input type="checkbox" checked disabled readOnly />
        {t("regulatory.transfers.form.fields")}: {t("regulatory.transfers.field.rfc")}
      </label>
    </FormDialog>
  );
}
