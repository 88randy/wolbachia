import { useState } from "react";
import { useT, useLocale } from "../../i18n/I18nProvider.tsx";
import { catalogLabel } from "../ovitrap-check/labels.ts";
import type { CatalogProps } from "./CatalogOptions.tsx";
export function useCatalogChoice(props: CatalogProps) {
  const [isOpen, setOpen] = useState(false);
  const t = useT();
  const locale = useLocale();
  const selected = props.items.find((item) => item.code === props.code);
  const label = selected
    ? catalogLabel(selected, locale)
    : t(props.items.length ? "mobile.lifecycle.chooseReason" : "mobile.lifecycle.noReasons");
  const close = () => {
    setOpen(false);
  };
  const open = () => {
    setOpen(true);
  };
  const choose = (code: string) => {
    props.choose(code);
    close();
  };
  return { isOpen, label, close, open, choose };
}
