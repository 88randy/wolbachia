/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { unwrap } from "@wolbachia/api-client";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { useMe } from "../../session/use-me";
import { Button } from "../../ui/Button";
import { SelectMenu } from "../../ui/SelectMenu";
import { Switch } from "../../ui/Switch";
import { FormDialog } from "../FormDialog";
import { useRegAction } from "../use-reg-action";
import { useRegScope } from "../use-reg-list";
import { ARCO_TYPES } from "./arco-types";
import type { ArcoType } from "./arco-types";

interface Draft {
  type: ArcoType | "";
  requester: string;
  assignMe: boolean;
}

const EMPTY: Draft = { type: "", requester: "", assignMe: true };

/** Register a request: type from a list, a reference and, optionally, yourself as owner. */
export function ArcoCreateDialog() {
  const { t } = useTranslation();
  const { client } = useRegScope();
  const me = useMe();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const action = useRegAction({
    successKey: "regulatory.arco.created",
    run: async (input: Draft & { type: ArcoType }, signal) =>
      unwrap(
        await client.POST("/api/v1/arco-requests/", {
          body: {
            request_type: input.type,
            requester_reference: input.requester.trim(),
            owner_id: input.assignMe ? me.user.id : null,
          },
          signal,
        }),
      ),
  });
  return (
    <FormDialog
      trigger={
        <Button leadingIcon={<Plus aria-hidden="true" />}>{t("regulatory.arco.new")}</Button>
      }
      title={t("regulatory.arco.new")}
      description={t("regulatory.arco.newDescription")}
      submitLabel={t("regulatory.arco.form.submit")}
      canSubmit={draft.type !== "" && draft.requester.trim() !== ""}
      isBusy={action.isBusy}
      hasFailed={action.hasFailed}
      onReset={() => {
        setDraft(EMPTY);
        action.reset();
      }}
      onSubmit={(close) => {
        if (draft.type !== "") action.submit({ ...draft, type: draft.type }, close);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="arco-type" className="text-xs font-semibold text-ink-2">
          {t("regulatory.arco.form.type")}
        </label>
        <SelectMenu
          id="arco-type"
          value={draft.type}
          placeholder={t("regulatory.arco.form.type")}
          options={ARCO_TYPES.map((value) => ({
            value,
            label: t(`regulatory.arco.type.${value}`),
          }))}
          onValueChange={(value) => {
            setDraft((current) => ({
              ...current,
              type: ARCO_TYPES.find((type) => type === value) ?? "",
            }));
          }}
        />
      </div>
      <TextField
        id="arco-requester"
        label={t("regulatory.arco.form.requester")}
        hint={t("regulatory.arco.form.requesterHint")}
        value={draft.requester}
        maxLength={200}
        required
        onChange={(event) => {
          setDraft((current) => ({ ...current, requester: event.target.value }));
        }}
      />
      <Switch
        label={t("regulatory.arco.form.assignMe")}
        isOn={draft.assignMe}
        onChange={(assignMe) => {
          setDraft((current) => ({ ...current, assignMe }));
        }}
      />
    </FormDialog>
  );
}
