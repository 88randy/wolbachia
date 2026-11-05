import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { useLanguage } from "../i18n/use-language";
import { useSessionIdentity } from "../session/use-session-identity";
import { voidReasonsQueryOptions } from "./void-reasons-query";

/** Historical reasons keep their label even after deactivation; missing catalogs use the code. */
export function useVoidReasonLabel(): (code: string) => string {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const query = useQuery(voidReasonsQueryOptions(client, identity));
  const { language } = useLanguage();
  return (code) => {
    const item = query.data?.find((candidate) => candidate.code === code);
    if (item === undefined) return code;
    return language === "en" && item.label_en.trim() !== "" ? item.label_en : item.label_es;
  };
}
