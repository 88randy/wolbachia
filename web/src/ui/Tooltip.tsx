import * as Primitive from "@radix-ui/react-tooltip";
import type { ReactElement, ReactNode } from "react";
import styles from "./ui.module.css";
export function Tooltip({ content, children }: { content: ReactNode; children: ReactElement }) {
  return (
    <Primitive.Provider delayDuration={150}>
      <Primitive.Root>
        <Primitive.Trigger asChild>{children}</Primitive.Trigger>
        <Primitive.Portal>
          <Primitive.Content className={styles.tooltip} sideOffset={4}>
            {content}
            <Primitive.Arrow className={styles.tooltipArrow} />
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
    </Primitive.Provider>
  );
}
