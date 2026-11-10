import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import { useCan } from "../session/use-can";
import { useDocumentTitle } from "../shell/use-document-title";
import { shiftOptions } from "./shifts-query";

/** Only a settled, freshly authorized read can enable a whole-shift decision. */
export function useShiftRecord(id: string) {
  const { t } = useTranslation();
  useDocumentTitle(t("shift.page.title"));
  const client = useApiClient();
  const identity = useSessionIdentity();
  const query = useQuery(shiftOptions(client, identity, id));
  const can = useCan();
  const refresh = () => {
    void query.refetch();
  };
  const isReady =
    !query.isFetching && !query.isError && !query.isPlaceholderData && identity.isSettled;
  return { query, refresh, isReady, canValidate: can("shift.validate") };
}
