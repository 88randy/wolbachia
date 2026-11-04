import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useMe } from "../session/use-me";

const SHORT_ID_LENGTH = 8;

/**
 * The name to show for the user id of a version (`created_by`, `voided_by`). The API sends only
 * the id today, so the signed-in user is named and anybody else is "User <first 8 characters of
 * the id>": enough to tell authors apart, never a guess. A version with no author (the seed) is
 * "System". When the API sends a username (follow-up issue), this is the one place that changes.
 */
export function useAuthorLabel(): (userId: string | null) => string {
  const { t } = useTranslation();
  const { user } = useMe();
  return useCallback(
    (userId) => {
      if (userId === null) return t("rules.history.system");
      if (userId === user.id) return user.username;
      return t("rules.history.userRef", { id: userId.slice(0, SHORT_ID_LENGTH) });
    },
    [t, user.id, user.username],
  );
}
