import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StateFrameProps {
  icon: LucideIcon;
  message: ReactNode;
  tone?: "neutral" | "critical";
  role?: "alert";
  children?: ReactNode;
}

/** Centered empty, error and blocked states: icon in a soft circle, one message, one action. */
export function StateFrame({
  icon: Icon,
  message,
  tone = "neutral",
  role,
  children,
}: StateFrameProps) {
  return (
    <div
      role={role}
      className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 py-10 text-center text-ink-2"
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-12 place-items-center rounded-full",
          tone === "critical" ? "bg-critical-bg text-critical-fg" : "bg-tint text-action",
        )}
      >
        <Icon strokeWidth={1.75} className="size-6" />
      </span>
      <p className="m-0 max-w-[60ch] text-sm leading-5 font-medium text-ink">{message}</p>
      {children}
    </div>
  );
}
