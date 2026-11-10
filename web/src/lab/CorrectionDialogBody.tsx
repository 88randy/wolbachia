import type { ComponentProps } from "react";
import { CorrectionContext } from "./CorrectionContext";

type CorrectionDialogBodyProps = Omit<ComponentProps<typeof CorrectionContext>, "onClose"> & {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function CorrectionDialogBody({
  isOpen,
  onOpenChange,
  ...context
}: CorrectionDialogBodyProps) {
  if (!isOpen) return null;
  return (
    <CorrectionContext
      {...context}
      onClose={() => {
        context.onBusyChange(false);
        onOpenChange(false);
      }}
    />
  );
}
