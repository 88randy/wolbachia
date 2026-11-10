import { ChevronLeft, ChevronRight } from "lucide-react";

interface PagerButtonProps {
  label: string;
  direction: "previous" | "next";
  isDisabled: boolean;
  onPress: () => void;
}

/**
 * An arrow button. `aria-disabled` instead of `disabled`: after pressing "Next" on the
 * second-to-last page the button becomes unavailable, and a truly disabled button would drop
 * keyboard focus to the page start. It stays focusable and does nothing.
 */
export function PagerButton({ label, direction, isDisabled, onPress }: PagerButtonProps) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={isDisabled}
      className="grid size-8 place-items-center rounded-lg border border-line bg-surface text-ink-2 shadow-xs transition-colors hover:bg-surface-muted hover:text-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-surface"
      onClick={() => {
        if (!isDisabled) onPress();
      }}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
    </button>
  );
}
