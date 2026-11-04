import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMe } from "../session/use-me";
import { AuthLayout } from "./AuthLayout";
import { OrganizationChoice } from "./OrganizationChoice";

/**
 * Organization choice for users with several active memberships: after sign-in when none is
 * selected yet, and from "Change organization" in the user menu. Not in the design (W1 to W71
 * have no such screen): built with the same tokens and layout as the sign-in page.
 */
export function SelectOrganizationPage() {
  const { t } = useTranslation();
  const me = useMe();
  const { redirect } = useSearch({ from: "/select-organization" });
  return (
    <AuthLayout title={t("auth.organization.title")}>
      <OrganizationChoice
        organizations={me.organizations}
        currentSlug={me.organization?.slug}
        redirectTo={redirect}
      />
    </AuthLayout>
  );
}
