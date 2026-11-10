import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { SelectMenu } from "../../ui/SelectMenu";
import type { SelectMenuOption } from "../../ui/SelectMenu";

interface LabeledSelectProps {
  label: string;
  value: string;
  options: readonly SelectMenuOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** A label above one shadcn select (search inside the list is not needed for short lists). */
export function LabeledSelect({ label, value, options, onChange, placeholder, className }: LabeledSelectProps) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">
        {label}
      </label>
      <SelectMenu id={id} value={value} options={options} onValueChange={onChange} placeholder={placeholder} />
    </div>
  );
}

/** One fact of a description grid: label above, value below, normal font. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-semibold text-ink-3">{label}</dt>
      <dd className="m-0 text-sm text-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export function FactGrid({ children }: { children: ReactNode }) {
  return <dl className="m-0 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>;
}

/** Big toggle card for a choice (filled when selected, never just an outline). */
export function ChoiceCard({
  checked,
  onToggle,
  title,
  icon,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        "flex min-h-14 min-w-44 items-center gap-3 rounded-xl border px-4 text-left text-sm font-semibold transition-colors",
        checked
          ? "border-action bg-action text-on-action"
          : "border-line bg-surface text-ink hover:bg-surface-muted",
      )}
    >
      {icon}
      {title}
    </button>
  );
}
