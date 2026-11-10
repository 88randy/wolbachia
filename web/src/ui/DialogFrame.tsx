import * as Primitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { DialogHeader } from "./DialogHeader";
import {
  DIALOG_CLASS,
  DIALOG_DESCRIPTION_CLASS,
  OVERLAY_CLASS,
  SHEET_CLASS,
} from "./overlay-classes";
export interface DialogFrameProps {
  trigger: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  isSheet?: boolean;
  open?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}
export function DialogFrame({
  trigger,
  title,
  description,
  children,
  isSheet = false,
  open,
  onOpenChange,
}: DialogFrameProps) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Overlay className={OVERLAY_CLASS} />
        <Primitive.Content className={isSheet ? SHEET_CLASS : DIALOG_CLASS}>
          <DialogHeader title={title} />
          <Primitive.Description className={DIALOG_DESCRIPTION_CLASS}>
            {description}
          </Primitive.Description>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
