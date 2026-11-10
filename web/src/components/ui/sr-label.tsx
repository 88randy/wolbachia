import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";

/** Translated text for the built-in labels of the vendored shadcn components. */
export function SrLabel({ k, visible = false }: { k: MessageKey; visible?: boolean }) {
  const { t } = useTranslation();
  return visible ? <>{t(k)}</> : <span className="sr-only">{t(k)}</span>;
}
