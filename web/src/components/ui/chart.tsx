import * as React from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

/** Series config (shadcn charts): each key gets a `--color-<key>` variable and a label. */
export type ChartConfig = Record<string, { label: string; color: string }>;

interface ChartContainerProps extends Omit<React.ComponentProps<"div">, "children"> {
  config: ChartConfig;
  children: React.ComponentProps<typeof ResponsiveContainer>["children"];
  height?: number;
}

/** shadcn `ChartContainer`: publishes the series colors as CSS variables and sizes the chart. */
function ChartContainer({
  config,
  className,
  children,
  height = 280,
  ...props
}: ChartContainerProps) {
  const style = Object.fromEntries(
    Object.entries(config).map(([key, entry]) => [`--color-${key}`, entry.color]),
  ) as React.CSSProperties;
  return (
    <div
      data-slot="chart"
      style={{ ...style, height }}
      className={cn(
        "w-full min-w-0 text-xs [&_.recharts-cartesian-axis-tick_text]:fill-ink-2 [&_.recharts-cartesian-grid_line]:stroke-line [&_.recharts-surface]:outline-none",
        className,
      )}
      {...props}
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height }}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export { ChartContainer };
