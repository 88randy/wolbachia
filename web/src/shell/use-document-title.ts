import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/** Sets `document.title` to "<page> · <brand>" so every page has its own title (WCAG 2.4.2). */
export function useDocumentTitle(pageTitle: string): void {
  const { t } = useTranslation();
  const brand = t("shell.brand.name");
  useEffect(() => {
    document.title = `${pageTitle} · ${brand}`;
  }, [pageTitle, brand]);
}
