import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/**
 * The name to show for the author of a version (`created_by_username`, `voided_by_username`).
 * The API sends the username of whoever wrote or voided it, kept even when that person left the
 * organization; a version with no author (the seed) is "System".
 */
export function useAuthorName(): (username: string | null | undefined) => string {
  const { t } = useTranslation();
  return useCallback(
    (username) =>
      username === null || username === undefined ? t("rules.history.system") : username,
    [t],
  );
}
