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
        "grid w-full min-w-0 grid-cols-1 items-start gap-x-4 gap-y-4 sm:grid-cols-2",
        columns === 2 ? "max-w-3xl" : "max-w-5xl lg:grid-cols-3",
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

/**
 * A field with a button next to it ("Buscar" by a code, "Mover" by a select). The button lines up
 * with the control's box, not with the label, and stays put when an error shows under the field.
 */
export function FormFieldRow({ field, action }: { field: ReactNode; action: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <div className="min-w-0 flex-1">{field}</div>
      {/* 24 px = 20 px label line + 4 px gap, so the button starts where the control starts. */}
      <div className="mt-6 flex-none">{action}</div>
    </div>
  );
}

/** The one action bar of a form: secondary actions, then the primary one, bottom right. */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
      {children}
    </div>
  );
}
