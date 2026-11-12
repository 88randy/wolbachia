import { Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useCan } from "../session/use-can";
import { buttonVariants } from "../ui/button-variants";
import { LABEL_KIND_SPECS } from "./label-kinds";
import type { LabelKind } from "./label-kinds";

/**
 * "Imprimir etiqueta" on a record page: opens the label tool (W19) with this record ticked. The
 * link carries the human code, never an id. Hidden when the user cannot print this kind.
 */
export function PrintLabelLink({ kind, code }: { kind: LabelKind; code: string }) {
  const { t } = useTranslation();
  const can = useCan();
  if (!can(LABEL_KIND_SPECS[kind].permission)) return null;
  return (
    <Link
      to="/inventory/labels"
      search={{ kind, code }}
      className={cn(buttonVariants({ variant: "tertiary" }))}
    >
      <Printer aria-hidden="true" />
      {t("labels.action.printOne")}
    </Link>
  );
}
