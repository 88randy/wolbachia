import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../../api/ApiClientProvider";
import { profilesOptions } from "../../people-admin/users-query";
import { useSessionIdentity } from "../../session/use-session-identity";

/** Label of a profile id in the interface language; an unknown id is shown as is. */
export function useProfileLabels(): (id: string) => string {
  const { i18n } = useTranslation();
  const profiles = useQuery(profilesOptions(useApiClient(), useSessionIdentity())).data ?? [];
  return (id) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return id;
    return i18n.language === "en" ? profile.label_en : profile.label_es;
  };
}
