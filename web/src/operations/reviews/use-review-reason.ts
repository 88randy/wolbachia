import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";

function camel(code: string): string {
  return code.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

/** The plain-language reason of a review code; unknown codes read "Needs review", never the raw code. */
export function useReviewReason(): (code: string | null | undefined) => string {
  const { t, i18n } = useTranslation();
  return (code) => {
    const key = `reviews.reason.${camel(code ?? "")}`;
    return t((i18n.exists(key) ? key : "reviews.reason.unknown") as MessageKey);
  };
}
