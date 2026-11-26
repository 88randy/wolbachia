/* eslint-disable max-lines-per-function -- presentational JSX of the wizard steps. */
import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { FormField, FormGrid } from "../../components/templates/FormGrid";
import { Combobox } from "../../ui/Combobox";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import { ChoiceCards } from "../ChoiceCards";
import { COUNTRIES, defaultTimezone, zoneLabel, zonesOf } from "./timezones";
import { slugify } from "./wizard-draft";
import type { DraftErrors, Language, OrganizationDraft } from "./wizard-draft";

export interface StepProps {
  draft: OrganizationDraft;
  errors: DraftErrors;
  onChange: (patch: Partial<OrganizationDraft>) => void;
}

const LANGUAGES: readonly Language[] = ["es-MX", "en"];
function PickerField(props: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={props.id} className="text-xs font-semibold text-ink-2">
        {props.label}
      </label>
      {props.children}
      {props.error && <p className="m-0 text-xs text-critical-fg">{props.error}</p>}
    </div>
  );
}

function useError(errors: DraftErrors) {
  const { t } = useTranslation();
  return (field: string) => {
    const key = errors[field];
    return key ? t(key) : undefined;
  };
}

export function StepData({ draft, errors, onChange }: StepProps) {
  const { t } = useTranslation();
  const error = useError(errors);
  return (
    <FormGrid>
      <FormField width="full">
        <TextField
          id="platform-name"
          label={t("platform.field.name")}
          placeholder={t("platform.field.namePlaceholder")}
          value={draft.name}
          maxLength={200}
          error={error("name")}
          onChange={(event) => {
            const name = event.target.value;
            onChange(draft.isSlugEdited ? { name } : { name, slug: slugify(name) });
          }}
        />
      </FormField>
      <FormField>
        <TextField
          id="platform-slug"
          label={t("platform.field.slug")}
          hint={t("platform.field.slugHint")}
          value={draft.slug}
          maxLength={64}
          autoCapitalize="none"
          spellCheck={false}
          error={error("slug")}
          onChange={(event) => {
            onChange({ slug: event.target.value.toLowerCase(), isSlugEdited: true });
          }}
        />
      </FormField>
    </FormGrid>
  );
}

export function StepRegion({ draft, errors, onChange }: StepProps) {
  const { t } = useTranslation();
  const error = useError(errors);
  const countries = COUNTRIES.map((code) => ({
    value: code,
    label: t(`platform.country.${code}`),
  }));
  const zones = zonesOf(draft.country).map((zone) => ({ value: zone, label: zoneLabel(zone) }));
  return (
    <div className="flex flex-col gap-5">
      <FormGrid>
        <FormField>
          <PickerField id="platform-country" label={t("platform.field.country")}>
            <Combobox
              id="platform-country"
              value={draft.country}
              options={countries}
              placeholder={t("platform.field.country")}
              onValueChange={(country) => {
                if (country) onChange({ country, timezone: defaultTimezone(country) });
              }}
            />
          </PickerField>
        </FormField>
        <FormField>
          <PickerField
            id="platform-timezone"
            label={t("platform.field.timezone")}
            error={error("timezone")}
          >
            <Combobox
              id="platform-timezone"
              value={draft.timezone}
              options={zones}
              invalid={error("timezone") !== undefined}
              placeholder={t("platform.field.timezone")}
              onValueChange={(timezone) => {
                if (timezone) onChange({ timezone });
              }}
            />
          </PickerField>
        </FormField>
      </FormGrid>
      <ChoiceCards
        name="epi-week"
        legend={t("platform.field.epiWeek")}
        value={draft.epiWeek}
        options={[
          { value: "iso", label: t("platform.field.epiWeekIso") },
          { value: "mmwr", label: t("platform.field.epiWeekMmwr") },
        ]}
        onChange={(epiWeek) => {
          onChange({ epiWeek });
        }}
      />
      <fieldset className="m-0 flex flex-col items-start gap-2 border-0 p-0">
        <legend className="mb-1.5 p-0 text-xs font-semibold text-ink-2">
          {t("platform.field.languages")}
        </legend>
        {LANGUAGES.map((language) => (
          <label key={language} className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={draft.languages.includes(language)}
              onChange={(event) => {
                const languages = event.target.checked
                  ? [...draft.languages, language]
                  : draft.languages.filter((item) => item !== language);
                onChange({ languages: LANGUAGES.filter((item) => languages.includes(item)) });
              }}
            />
            {t(`platform.language.${language}`)}
          </label>
        ))}
        {error("languages") && <p className="m-0 text-xs text-critical-fg">{error("languages")}</p>}
      </fieldset>
    </div>
  );
}

export function StepCenters({ draft, errors, onChange }: StepProps) {
  const { t } = useTranslation();
  const error = useError(errors);
  const update = (key: number, patch: { code?: string; name?: string }) => {
    onChange({
      centers: draft.centers.map((center) =>
        center.key === key ? { ...center, ...patch } : center,
      ),
    });
  };
  return (
    <div className="flex flex-col gap-4">
      {draft.centers.map((center, index) => (
        <div
          key={center.key}
          className="grid items-start gap-3 sm:grid-cols-[160px_minmax(0,1fr)_auto]"
        >
          <TextField
            id={`center-${String(center.key)}-code`}
            label={t("platform.field.centerCode")}
            value={center.code}
            maxLength={50}
            placeholder="C-01"
            error={error(`center-${String(center.key)}-code`)}
            onChange={(event) => {
              update(center.key, { code: event.target.value.toUpperCase() });
            }}
          />
          <TextField
            id={`center-${String(center.key)}-name`}
            label={t("platform.field.centerName")}
            value={center.name}
            maxLength={200}
            error={error(`center-${String(center.key)}-name`)}
            onChange={(event) => {
              update(center.key, { name: event.target.value });
            }}
          />
          <div className="pt-6">
            {draft.centers.length > 1 && (
              <Button
                variant="ghost"
                aria-label={t("platform.centers.remove", { index: index + 1 })}
                leadingIcon={<Trash2 aria-hidden="true" />}
                onClick={() => {
                  onChange({ centers: draft.centers.filter((item) => item.key !== center.key) });
                }}
              />
            )}
          </div>
        </div>
      ))}
      {error("centers") && <InlineNotice tone="critical">{error("centers")}</InlineNotice>}
      <div>
        <Button
          variant="secondary"
          leadingIcon={<Plus aria-hidden="true" />}
          aria-disabled={draft.centers.length >= 20 || undefined}
          onClick={() => {
            const key = Math.max(0, ...draft.centers.map((center) => center.key)) + 1;
            onChange({ centers: [...draft.centers, { key, code: "", name: "" }] });
          }}
        >
          {t("platform.centers.add")}
        </Button>
      </div>
    </div>
  );
}

export function StepAdmin({ draft, errors, onChange }: StepProps) {
  const { t } = useTranslation();
  const error = useError(errors);
  return (
    <div className="flex flex-col gap-5">
      <FormGrid>
        <TextField
          id="admin-first-name"
          label={t("platform.field.firstName")}
          value={draft.firstName}
          maxLength={150}
          autoComplete="off"
          error={error("firstName")}
          onChange={(event) => {
            onChange({ firstName: event.target.value });
          }}
        />
        <TextField
          id="admin-last-name"
          label={t("platform.field.lastName")}
          value={draft.lastName}
          maxLength={150}
          autoComplete="off"
          error={error("lastName")}
          onChange={(event) => {
            onChange({ lastName: event.target.value });
          }}
        />
        <TextField
          id="admin-username"
          label={t("platform.field.username")}
          hint={t("platform.field.usernameHint")}
          value={draft.username}
          maxLength={150}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          error={error("username")}
          onChange={(event) => {
            onChange({ username: event.target.value.trim() });
          }}
        />
        <TextField
          id="admin-email"
          type="email"
          label={t("platform.field.email")}
          value={draft.email}
          maxLength={254}
          autoComplete="off"
          error={error("email")}
          onChange={(event) => {
            onChange({ email: event.target.value.trim() });
          }}
        />
      </FormGrid>
      <ChoiceCards
        name="delivery"
        legend={t("platform.field.delivery")}
        value={draft.delivery}
        options={[
          {
            value: "password",
            label: t("platform.field.deliveryPassword"),
            hint: t("platform.field.deliveryPasswordHint"),
          },
          {
            value: "invite",
            label: t("platform.field.deliveryInvite"),
            hint: t("platform.field.deliveryInviteHint"),
          },
        ]}
        onChange={(delivery) => {
          onChange({ delivery });
        }}
      />
    </div>
  );
}
