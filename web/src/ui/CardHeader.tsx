import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
interface CardHeaderProps {
  title: ReactNode;
  id: string;
  headingLevel: 1 | 2 | 3;
  actions?: ReactNode;
  period?: ReactNode;
}
const HEADINGS = { 1: "h1", 2: "h2", 3: "h3" } as const;
export function CardHeader({ title, id, headingLevel, actions, period }: CardHeaderProps) {
  const Heading = HEADINGS[headingLevel];
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-6 pt-5 pb-1"
      data-has-period={period ? true : undefined}
    >
      <Heading
        id={id}
        className={cn(
          "m-0 min-w-0 flex-[0_1_auto] text-[15px] leading-6 font-semibold tracking-tight [overflow-wrap:anywhere]",
          headingLevel === 1 && "text-2xl leading-8 font-bold",
        )}
      >
        {title}
      </Heading>
      {(actions ?? period) && (
        <div className="ml-auto inline-flex flex-none flex-wrap items-center gap-2">
          {actions}
          {period}
        </div>
      )}
    </div>
  );
}
