import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import styles from "./analytics.module.css";
interface AbsoluteTimeTooltipProps {
  children: ReactNode;
  absolute: string;
}
export function AbsoluteTimeTooltip({ children, absolute }: AbsoluteTimeTooltipProps) {
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className={styles.absoluteTooltip} sideOffset={8}>
            {absolute}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
