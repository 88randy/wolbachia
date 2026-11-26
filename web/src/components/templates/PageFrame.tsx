import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Page padding and vertical rhythm shared by the four templates. */
export function PageFrame({
  children,
  width = "wide",
  className,
}: {
  children: ReactNode;
  /** `narrow` for forms and wizards, `wide` for lists, details and dashboards. */
  width?: "wide" | "narrow";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "mx-auto flex w-full min-w-0 flex-col gap-5 px-6 pt-5 pb-10",
        width === "narrow" ? "max-w-3xl" : "max-w-[1440px]",
        className,
      )}
    >
      {children}
    </section>
  );
}
