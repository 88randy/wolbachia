import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { tableErrorKey } from "../data-table/table-error";
import { useToast } from "../ui/toast-context";
import { invalidateCommunity } from "./community-query";

export interface ActivityDraft {
  typeId: string;
  zoneId: string;
  attendance: string;
  agreements: string;
  otherText: string;
}

const EMPTY: ActivityDraft = {
  typeId: "",
  zoneId: "",
  attendance: "",
  agreements: "",
  otherText: "",
};
const WHOLE_NUMBER = /^\d{1,15}$/;

export type ActivityField = keyof ActivityDraft;

/** Which fields fail the checks the server repeats (it stays the authority). */
export function draftErrors(draft: ActivityDraft, isOther: boolean): ActivityField[] {
  const errors: ActivityField[] = [];
  if (draft.typeId === "") errors.push("typeId");
  if (draft.zoneId === "") errors.push("zoneId");
  if (!WHOLE_NUMBER.test(draft.attendance.trim())) errors.push("attendance");
  if (draft.agreements.trim() === "") errors.push("agreements");
  if (isOther && draft.otherText.trim() === "") errors.push("otherText");
  return errors;
}

/** One explicit save: the draft stays on screen when the server refuses. */
export function useActivityForm(isOther: (typeId: string) => boolean, onSaved: () => void) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [draft, setDraft] = useState(EMPTY);
  const [errors, setErrors] = useState<ActivityField[]>([]);
  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await client.POST("/api/v1/community-activities/", {
          body: {
            command_id: crypto.randomUUID(),
            type_id: draft.typeId,
            zone_id: draft.zoneId,
            attendance: Number(draft.attendance.trim()),
            agreements: draft.agreements.trim(),
            other_text: isOther(draft.typeId) ? draft.otherText.trim() : "",
          },
        }),
      ),
    onSuccess: async () => {
      await invalidateCommunity(queryClient);
      showToast({ message: t("community.form.saved"), tone: "success" });
      setDraft(EMPTY);
      onSaved();
    },
  });
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const found = draftErrors(draft, isOther(draft.typeId));
    setErrors(found);
    if (found.length === 0 && !save.isPending) save.mutate();
  };
  return {
    draft,
    errors,
    isSaving: save.isPending,
    failure: save.error === null ? undefined : tableErrorKey(save.error),
    submit,
    set: (field: ActivityField, value: string) => {
      setDraft((previous) => ({ ...previous, [field]: value }));
    },
  };
}
