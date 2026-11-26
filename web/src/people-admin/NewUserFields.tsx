/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { centersOptions } from "../centers/centers-query";
import { FormField, FormGrid } from "../components/templates/FormGrid";
import { FormSection } from "../components/templates/FormSection";
import { TextField } from "../forms/TextField";
import { useSessionIdentity } from "../session/use-session-identity";
import { NewUserScope } from "./NewUserScope";
import { PickerSelect } from "./PickerSelect";
import type { NewUserForm } from "./use-new-user-form";
import { profilesOptions } from "./users-query";

/** Identity, center, profile and center scope of a new person. */
export function NewUserFields({ form }: { form: NewUserForm }) {
  const { t, i18n } = useTranslation();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const base = useId();
  const centers = useQuery(centersOptions(client, identity)).data ?? [];
  const profiles = useQuery(profilesOptions(client, identity)).data ?? [];
  const { values, change } = form;
  return (
    <>
      <FormSection title={t("users.new.sectionData")}>
        <FormGrid>
          <FormField width="full">
            <TextField
              id={`${base}-name`}
              label={t("users.new.name")}
              value={values.displayName}
              required
              maxLength={150}
              onChange={(event) => {
                change({ displayName: event.target.value });
              }}
            />
          </FormField>
          <FormField>
            <TextField
              id={`${base}-username`}
              label={t("users.new.username")}
              value={values.username}
              required
              maxLength={150}
              autoComplete="off"
              onChange={(event) => {
                change({ username: event.target.value });
              }}
            />
          </FormField>
          <FormField>
            <TextField
              id={`${base}-email`}
              label={t("users.new.email")}
              type="email"
              value={values.email}
              maxLength={254}
              onChange={(event) => {
                change({ email: event.target.value });
              }}
            />
          </FormField>
        </FormGrid>
      </FormSection>
      <FormSection title={t("users.new.sectionAccess")}>
        <FormGrid>
          <FormField>
            <PickerSelect
              id={`${base}-center`}
              label={t("users.new.center")}
              placeholder={t("users.new.centerPlaceholder")}
              value={values.centerId}
              options={centers.map((center) => ({ value: center.id, label: center.name }))}
              onChange={(centerId) => {
                change({ centerId });
              }}
            />
          </FormField>
          <FormField>
            <PickerSelect
              id={`${base}-profile`}
              label={t("users.new.profile")}
              placeholder={t("users.new.profilePlaceholder")}
              value={values.profileId}
              options={profiles
                .filter((item) => item.is_active)
                .map((item) => ({
                  value: item.id,
                  label: i18n.language === "en" ? item.label_en : item.label_es,
                }))}
              onChange={(profileId) => {
                change({ profileId });
              }}
            />
          </FormField>
        </FormGrid>
      </FormSection>
      <NewUserScope form={form} centers={centers} />
    </>
  );
}
