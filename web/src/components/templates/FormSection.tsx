import { useId } from "react";
import type { ReactNode } from "react";

/** A titled group of fields inside a form (a fieldset with a visible legend). */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <fieldset
      aria-describedby={description ? id : undefined}
      className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0"
    >
      <legend className="mb-1 p-0 text-sm font-semibold text-ink">{title}</legend>
      {description && (
        <p id={id} className="m-0 -mt-2 text-[13px] text-ink-2">
          {description}
        </p>
      )}
      {children}
    </fieldset>
  );
}
