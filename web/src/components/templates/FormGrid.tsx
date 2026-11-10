import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 2 or 3 column grid for form fields. Wrap a field in `<FormField width>` to size it:
 * `short` (dates, numbers, codes: one column), `medium` (default), `full` (notes, long text).
 */
export function FormGrid({ columns = 2, children }: { columns?: 2 | 3; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 items-start gap-x-5 gap-y-4 sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

const WIDTHS = {
  short: "max-w-60",
  medium: "",
  full: "sm:col-span-full",
} as const;

/** One cell of a `FormGrid`. */
export function FormField({
  width = "medium",
  children,
}: {
  width?: keyof typeof WIDTHS;
  children: ReactNode;
}) {
  return <div className={cn("min-w-0", WIDTHS[width])}>{children}</div>;
}

/** The one action bar of a form: secondary actions, then the primary one, bottom right. */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
      {children}
    </div>
  );
}
