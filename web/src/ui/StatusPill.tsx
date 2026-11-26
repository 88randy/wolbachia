import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ToneIcon } from "./ToneIcon";
import type { Tone } from "./tone";
import { TONE_CLASSES } from "./tone-classes";
export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex w-max shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs leading-5 font-semibold whitespace-nowrap [&_svg]:size-3.5",
        TONE_CLASSES[tone],
      )}
    >
      <ToneIcon tone={tone} />
      {children}
    </span>
  );
}
