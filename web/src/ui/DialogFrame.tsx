import * as Primitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { classNames } from "../styles/class-names";
import { DialogHeader } from "./DialogHeader";
import styles from "./ui.module.css";
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
        <Primitive.Overlay className={styles.overlay} />
        <Primitive.Content className={classNames(styles.dialog, isSheet && styles.sheet)}>
          <DialogHeader title={title} />
          <Primitive.Description className={styles.description}>
            {description}
          </Primitive.Description>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
