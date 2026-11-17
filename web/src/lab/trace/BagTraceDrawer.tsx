import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BagTracePanel } from "./BagTracePanel";

/** The bag's full origin in a side drawer; the page behind keeps its place. */
export function BagTraceDrawer({ code, onClose }: { code: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-[min(100vw,36rem)] gap-5 overflow-auto p-6 sm:max-w-none">
        <SheetHeader className="p-0">
          <SheetTitle className="text-xl">{t("labTrace.drawerTitle", { code })}</SheetTitle>
          <SheetDescription>{t("labTrace.drawerHint")}</SheetDescription>
        </SheetHeader>
        <BagTracePanel code={code} variant="full" />
      </SheetContent>
    </Sheet>
  );
}
