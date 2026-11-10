import { useState } from "react";
import { useTranslation } from "react-i18next";
import formStyles from "../forms/form.module.css";
import { ServiceFailureAlert } from "../forms/ServiceFailureAlert";
import { SubmitButton } from "../forms/SubmitButton";
import type { Me } from "../session/me";
import styles from "./auth.module.css";
import { OrganizationOptions } from "./OrganizationOptions";
import { useSelectOrganization } from "./use-select-organization";

interface OrganizationChoiceProps {
  organizations: Me["organizations"];
  /** Slug already active, if any (the user is changing organization). */
  currentSlug: string | undefined;
  redirectTo: string | undefined;
}

/** The organizations of the user as a radio group and a Continue button. */
export function OrganizationChoice({
  organizations,
  currentSlug,
  redirectTo,
}: OrganizationChoiceProps) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState(currentSlug ?? organizations[0]?.slug ?? "");
  const { select, isBusy, failure, alertRef } = useSelectOrganization(redirectTo);
  return (
    <form
      className={formStyles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!isBusy) void select(chosen);
      }}
    >
      <p className={styles.body}>{t("auth.organization.body")}</p>
      <ServiceFailureAlert id="organization-alert" ref={alertRef} failure={failure} />
      <OrganizationOptions organizations={organizations} chosen={chosen} onChoose={setChosen} />
      <SubmitButton
        block
        label={t("auth.organization.submit")}
        busyLabel={t("auth.login.submitting")}
        isBusy={isBusy}
      />
    </form>
  );
}
