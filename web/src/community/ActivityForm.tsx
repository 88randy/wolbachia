import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { FormAlert } from "../forms/FormAlert";
import type { PickerOption } from "../forms/OptionPicker";
import { SubmitButton } from "../forms/SubmitButton";
import { useLanguage } from "../i18n/use-language";
import { useSessionIdentity } from "../session/use-session-identity";
import { Button } from "../ui/Button";
import { DialogFooter } from "../ui/DialogFooter";
import { ActivityFields } from "./ActivityFields";
import { typeLabel } from "./activity-labels";
import { activityChoicesOptions } from "./community-query";
import { useActivityForm } from "./use-activity-form";

interface Props {
  onSaved: () => void;
  onCancel: () => void;
}

/** The new-activity form: its pickers come from the catalog and the zones the user may record. */
export function ActivityForm({ onSaved, onCancel }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const idBase = useId();
  const choices = useQuery(activityChoicesOptions(useApiClient(), useSessionIdentity())).data;
  const others = new Set(choices?.types.filter((item) => item.is_other).map((item) => item.id));
  const form = useActivityForm((id) => others.has(id), onSaved);
  const types: PickerOption[] = (choices?.types ?? []).map((item) => ({
    value: item.id,
    label: typeLabel(item, language),
  }));
  const zones: PickerOption[] = (choices?.zones ?? []).map((zone) => ({
    value: zone.id,
    label: zone.code,
    hint: zone.quadrant_code,
  }));
  return (
    <form className="flex flex-col gap-4" onSubmit={form.submit} noValidate>
      <ActivityFields
        {...{ idBase, types, zones }}
        draft={form.draft}
        errors={form.errors}
        isOther={others.has(form.draft.typeId)}
        isSaving={form.isSaving}
        onChange={form.set}
      />
      {form.failure !== undefined && (
        <FormAlert
          id={`${idBase}-failure`}
          title={t("community.form.failed")}
          text={t(form.failure)}
        />
      )}
      <DialogFooter>
        <Button variant="secondary" onClick={onCancel}>
          {t("community.form.cancel")}
        </Button>
        <SubmitButton
          label={t("community.form.save")}
          busyLabel={t("community.form.saving")}
          isBusy={form.isSaving}
        />
      </DialogFooter>
    </form>
  );
}
