/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { centersOptions } from "../centers/centers-query";
import { useSessionIdentity } from "../session/use-session-identity";
import { useCan } from "../session/use-can";
import { membershipProfilesOptions, profilesOptions } from "./users-query";

/** Names for ids: profiles of a membership and center names. Missing reads show a dash. */
export function usePeopleLookups() {
  const { i18n } = useTranslation();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const can = useCan();
  const canReadRoles = can("role.read");
  const memberships = useQuery({
    ...membershipProfilesOptions(client, identity),
    enabled: canReadRoles,
  });
  const profiles = useQuery({ ...profilesOptions(client, identity), enabled: canReadRoles });
  const centers = useQuery(centersOptions(client, identity));
  const isEnglish = i18n.language === "en";
  return useMemo(() => {
    const labelOf = new Map(
      (profiles.data ?? []).flatMap((item) => {
        const label = isEnglish ? item.label_en : item.label_es;
        return [
          [item.slug, label],
          [item.id, label],
        ] as const;
      }),
    );
    const byMembership = new Map((memberships.data ?? []).map((item) => [item.id, item.profiles]));
    const centerOf = new Map((centers.data ?? []).map((item) => [item.id, item.name]));
    return {
      /** Memberships may be out of the reader's scope; then the profile column is hidden. */
      hasProfiles: byMembership.size > 0,
      profilesOf: (membership: string) =>
        (byMembership.get(membership) ?? []).map((code) => labelOf.get(code) ?? code).join(" · "),
      centerName: (center: string) => centerOf.get(center) ?? "—",
    };
  }, [profiles.data, memberships.data, centers.data, isEnglish]);
}

export type PeopleLookups = ReturnType<typeof usePeopleLookups>;
