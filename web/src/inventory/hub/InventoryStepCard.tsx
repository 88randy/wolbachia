import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "../../ui/button-variants";
import { StatusPill } from "../../ui/StatusPill";
import type { Tone } from "../../ui/tone";

export interface InventoryStepCardProps {
  number: number;
  title: string;
  text: string;
  /** What is true now, in one line, with the numbers. */
  summary: string;
  /** A pill only when something waits for the user. */
  pill?: { tone: Tone; label: string } | undefined;
  actionLabel: string;
  link: Pick<LinkProps, "to" | "search">;
  isPrimary: boolean;
}

/** One step of the daily inventory flow: what it is, how it stands now, and one action. */
export function InventoryStepCard(props: InventoryStepCardProps) {
  const { number, title, text, summary, pill, actionLabel, link, isPrimary } = props;
  return (
    <li className="flex min-w-0 flex-wrap items-start gap-x-5 gap-y-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <span
        aria-hidden="true"
        className="grid size-10 flex-none place-items-center rounded-full bg-tint text-base font-bold text-action-strong"
      >
        {number}
      </span>
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1.5">
        <h3 className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-base leading-6 font-semibold text-ink">
          {title}
          {pill && <StatusPill tone={pill.tone}>{pill.label}</StatusPill>}
        </h3>
        <p className="m-0 text-sm leading-5 text-ink-2">{text}</p>
        {summary && <p className="m-0 text-sm leading-5 font-semibold text-ink">{summary}</p>}
      </div>
      <Link
        {...link}
        className={cn(
          buttonVariants({ variant: isPrimary ? "primary" : "secondary", size: "lg" }),
          "self-center",
        )}
      >
        {actionLabel}
        <ArrowRight aria-hidden="true" />
      </Link>
    </li>
  );
}
