import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export interface LabDetail {
  title: string;
  description?: string;
  status?: ReactNode;
  content: ReactNode;
}

/** Row detail in a side sheet: title, status pill and a facts grid. Same structure as DetailPage. */
export function LabDetailSheet({
  detail,
  onClose,
}: {
  detail: LabDetail | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={detail !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-[min(100vw,30rem)] gap-5 overflow-auto p-6 sm:max-w-none">
        <SheetHeader className="p-0">
          <div className="flex flex-wrap items-center gap-3">
            <SheetTitle className="text-xl">{detail?.title}</SheetTitle>
            {detail?.status}
          </div>
          <SheetDescription>{detail?.description}</SheetDescription>
        </SheetHeader>
        {detail?.content}
      </SheetContent>
    </Sheet>
  );
}
