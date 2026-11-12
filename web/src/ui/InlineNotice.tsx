import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ToneIcon } from "./ToneIcon";
import type { Tone } from "./tone";
import { TONE_BORDER, TONE_CLASSES } from "./tone-classes";
export function InlineNotice({
  tone = "info",
  children,
  action,
  role,
}: {
  tone?: Tone;
  children: ReactNode;
  action?: ReactNode;
  /** "status" makes a result (a saved change) a polite live region for screen readers. */
  role?: "status";
}) {
  return (
    <div
      role={role}
      className={cn(
        "flex flex-wrap items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px] leading-5 [&>svg]:mt-0.5",
        TONE_CLASSES[tone],
        TONE_BORDER[tone],
      )}
    >
      <ToneIcon tone={tone} />
      <div className="min-w-0 flex-1 [&_p]:m-0">{children}</div>
      {action}
    </div>
  );
}
