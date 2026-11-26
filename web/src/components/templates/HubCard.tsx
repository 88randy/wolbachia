import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "../../ui/tone";
import { TONE_CLASSES } from "../../ui/tone-classes";

export interface HubCardItem {
  /** Stable key, usually the route path. */
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  link: Pick<LinkProps, "to" | "search" | "params">;
  /** Optional count badge (pending items). Every number links to the records behind it. */
  count?: number;
  /** Tone of the count badge; the count text always accompanies the color. */
  tone?: Tone;
  /** Extra line, e.g. "3 por vencer". */
  meta?: ReactNode;
}

/** One icon card: the whole card is the link, with a visible focus ring and hover lift. */
export function HubCard({ item }: { item: HubCardItem }) {
  const Icon = item.icon;
  return (
    <Link
      {...item.link}
      className={cn(
        "group flex h-full min-h-28 min-w-0 items-start gap-4 rounded-2xl border border-line bg-surface p-5 text-ink no-underline shadow-card",
        "transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-action/40 hover:shadow-overlay",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-11 flex-none place-items-center rounded-xl bg-tint text-action"
      >
        <Icon strokeWidth={1.75} className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 text-[15px] leading-6 font-semibold [overflow-wrap:anywhere]">
            {item.title}
          </span>
          {item.count !== undefined && (
            <span
              className={cn(
                "inline-flex min-w-6 justify-center rounded-full px-2 text-xs leading-5 font-bold tabular-nums",
                TONE_CLASSES[item.tone ?? "info"],
              )}
            >
              {item.count}
            </span>
          )}
        </span>
        <span className="text-[13px] leading-5 text-ink-2">{item.description}</span>
        {item.meta && <span className="text-xs font-medium text-ink-3">{item.meta}</span>}
      </span>
      <ChevronRight
        aria-hidden="true"
        strokeWidth={1.75}
        className="mt-3 size-4 flex-none text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-action"
      />
    </Link>
  );
}
