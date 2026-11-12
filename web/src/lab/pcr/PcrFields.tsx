import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { Combobox } from "../../ui/Combobox";
import type { ComboboxOption } from "../../ui/Combobox";

interface LabeledSelectProps {
  label: string;
  value: string;
  options: readonly ComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** A label above one combobox picker (search inside the dropdown). */
export function LabeledSelect({ label, value, options, onChange, placeholder, className }: LabeledSelectProps) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">
        {label}
      </label>
      <Combobox id={id} value={value} options={options} onValueChange={onChange} placeholder={placeholder} />
    </div>
  );
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
        "flex min-h-14 min-w-44 flex-none items-center gap-3 rounded-xl border px-4 text-left text-sm font-semibold whitespace-nowrap transition-colors",
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
