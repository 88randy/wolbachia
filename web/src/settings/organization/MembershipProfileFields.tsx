import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../../api/ApiClientProvider";
import { profilesOptions } from "../../people-admin/users-query";
import { useSessionIdentity } from "../../session/use-session-identity";
import type { ScopeEditor } from "./use-scope-editor";

/** Profile checkboxes of a membership. Profiles already held stay checked until the admin clears them. */
export function MembershipProfileFields({
  editor,
}: {
  editor: Pick<ScopeEditor, "profiles" | "toggleProfile">;
}) {
  const { t, i18n } = useTranslation();
  const profiles = useQuery(profilesOptions(useApiClient(), useSessionIdentity())).data ?? [];
  return (
    <fieldset>
      <legend>{t("users.members.profilesField")}</legend>
      {profiles
        .filter((profile) => profile.is_active || editor.profiles.includes(profile.id))
        .map((profile) => (
          <label key={profile.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editor.profiles.includes(profile.id)}
              onChange={() => {
                editor.toggleProfile(profile.id);
              }}
            />
            {i18n.language === "en" ? profile.label_en : profile.label_es}
          </label>
        ))}
    </fieldset>
  );
}
