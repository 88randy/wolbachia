/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a form dialog; splitting it into one-use fragments would hurt readability. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useOrganizationTimeZone } from "../../format/use-time-zone";
import { TextField } from "../../forms/TextField";
import { Combobox } from "../../regulatory/Combobox";
import { FormDialog } from "../../regulatory/FormDialog";
import { centersOptions, quadrantsOfCenterOptions } from "../../regulatory/reg-queries";
import { DateRangeField } from "../../regulatory/toolbar/DateRangeField";
import { endOfDayInstant, startOfDayInstant } from "../../regulatory/toolbar/date-range";
import { useRegScope } from "../../regulatory/use-reg-list";
import { invalidateOrgScoped } from "../../session/org-scoped-query";
import { reportSessionError } from "../../session/session-events";
import { Button } from "../../ui/Button";
import { useToast } from "../../ui/toast-context";
import { API_KEY_ENDPOINTS } from "./api-keys-queries";
import type { CreatedKey } from "./ApiKeySecretDialog";

interface Draft {
  institution: string;
  center: string;
  quadrant: string;
  endpoints: readonly string[];
  limit: string;
  from: string | undefined;
  to: string | undefined;
}

const EMPTY: Draft = {
  institution: "",
  center: "",
  quadrant: "",
  endpoints: [],
  limit: "1000",
  from: undefined,
  to: undefined,
};

/** New key: zone, data and validity are picked, never typed. The secret goes to `onCreated`. */
export function ApiKeyCreateDialog({ onCreated }: { onCreated: (created: CreatedKey) => void }) {
  const { t } = useTranslation();
  const scope = useRegScope();
  const cache = useQueryClient();
  const { showToast } = useToast();
  const timeZone = useOrganizationTimeZone();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const centers = useQuery(centersOptions(scope));
  const quadrants = useQuery({
    ...quadrantsOfCenterOptions(scope, draft.center),
    enabled: draft.center !== "",
  });
  const patch = (next: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };
  const validFrom = draft.from === undefined ? undefined : startOfDayInstant(draft.from, timeZone);
  const validUntil = endOfDayInstant(draft.to ?? draft.from ?? "", timeZone);
  const limit = Number(draft.limit);
  const canSubmit =
    draft.institution.trim() !== "" &&
    draft.center !== "" &&
    draft.endpoints.length > 0 &&
    Number.isInteger(limit) &&
    limit > 0 &&
    validFrom !== undefined &&
    validUntil !== undefined;
  // The mutation returns nothing: the secret must not sit in the query client's mutation cache.
  const mutation = useMutation({
    mutationFn: async () => {
      const answer = unwrap(
        await scope.client.POST("/api/v1/api-keys/", {
          body: {
            institution: draft.institution.trim(),
            center_id: draft.center,
            quadrant_id: draft.quadrant === "" ? null : draft.quadrant,
            endpoints: API_KEY_ENDPOINTS.filter((code) => draft.endpoints.includes(code)),
            rate_limit_per_day: limit,
            valid_from: validFrom ?? "",
            valid_until: validUntil ?? "",
          },
        }),
      );
      onCreated({ institution: answer.institution, secret: answer.secret });
    },
    onSuccess: () => {
      void invalidateOrgScoped(cache, "regulatory");
      showToast({ message: t("apiKeys.created"), tone: "success" });
    },
    onError: (error) => {
      reportSessionError(error, cache);
    },
  });
  const toggle = (code: string) => {
    patch({
      endpoints: draft.endpoints.includes(code)
        ? draft.endpoints.filter((item) => item !== code)
        : [...draft.endpoints, code],
    });
  };
  return (
    <FormDialog
      trigger={<Button leadingIcon={<Plus aria-hidden="true" />}>{t("apiKeys.new")}</Button>}
      title={t("apiKeys.new")}
      description={t("apiKeys.newDescription")}
      submitLabel={t("apiKeys.form.submit")}
      canSubmit={canSubmit}
      isBusy={mutation.isPending}
      hasFailed={mutation.isError}
      onReset={() => {
        setDraft(EMPTY);
        mutation.reset();
      }}
      onSubmit={(close) => {
        mutation.mutate(undefined, { onSuccess: close });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField
            id="api-key-institution"
            label={t("apiKeys.form.institution")}
            value={draft.institution}
            maxLength={200}
            required
            onChange={(event) => {
              patch({ institution: event.target.value });
            }}
          />
        </div>
        <Combobox
          label={t("apiKeys.form.center")}
          value={draft.center}
          placeholder={t("apiKeys.form.centerPlaceholder")}
          options={(centers.data?.results ?? []).map((center) => ({
            value: center.id,
            label: center.name,
            detail: center.code,
          }))}
          onChange={(center) => {
            patch({ center, quadrant: "" });
          }}
        />
        <Combobox
          label={t("apiKeys.form.quadrant")}
          value={draft.quadrant}
          disabled={draft.center === ""}
          placeholder={t("apiKeys.form.quadrantPlaceholder")}
          clearLabel={t("apiKeys.form.quadrantPlaceholder")}
          options={(quadrants.data?.results ?? []).map((quadrant) => ({
            value: quadrant.id,
            label: quadrant.code,
          }))}
          onChange={(quadrant) => {
            patch({ quadrant });
          }}
        />
        <div className="sm:col-span-2">
          <DateRangeField
            label={t("apiKeys.form.validity")}
            from={draft.from}
            to={draft.to}
            onChange={(range) => {
              patch(range);
            }}
          />
        </div>
        <div className="sm:max-w-48">
          <TextField
            id="api-key-limit"
            label={t("apiKeys.form.limit")}
            value={draft.limit}
            inputMode="numeric"
            maxLength={7}
            required
            onChange={(event) => {
              patch({ limit: event.target.value.replace(/\D/g, "") });
            }}
          />
        </div>
      </div>
      <fieldset className="m-0 flex min-w-0 flex-col items-start gap-2 border-0 p-0">
        <legend className="mb-1 p-0 text-xs font-semibold text-ink-2">
          {t("apiKeys.form.endpoints")}
        </legend>
        {API_KEY_ENDPOINTS.map((code) => (
          <label key={code} className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <input
              type="checkbox"
              checked={draft.endpoints.includes(code)}
              onChange={() => {
                toggle(code);
              }}
            />
            {t(`apiKeys.endpoint.${code}`)}
          </label>
        ))}
      </fieldset>
    </FormDialog>
  );
}
