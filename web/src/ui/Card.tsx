import { useId } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CardHeader } from "./CardHeader";
export interface CardProps {
  title: ReactNode;
  titleId?: string;
  headingLevel?: 1 | 2 | 3;
  className?: string;
  actions?: ReactNode;
  period?: ReactNode;
  children: ReactNode;
  muted?: boolean;
}
export function Card(props: CardProps) {
  const generatedId = useId();
  const id = props.titleId ?? generatedId;
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "max-w-full min-w-0 rounded-2xl border border-line bg-surface text-ink shadow-card",
        props.muted && "bg-surface-muted",
        props.className,
      )}
    >
      <CardHeader {...props} id={id} headingLevel={props.headingLevel ?? 2} />
      <div className="min-w-0 px-6 pt-3 pb-6">{props.children}</div>
    </section>
  );
}
