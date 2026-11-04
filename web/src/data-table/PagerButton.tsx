import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";

interface PagerButtonProps {
  label: string;
  isDisabled: boolean;
  onPress: () => void;
}

/**
 * `aria-disabled` instead of `disabled`: after pressing "Next" on the second-to-last page the
 * button becomes unavailable, and a truly disabled button would drop keyboard focus to the page
 * start. It stays focusable and does nothing.
 */
export function PagerButton({ label, isDisabled, onPress }: PagerButtonProps) {
  return (
    <button
      type="button"
      className={classNames(buttons.button, buttons.secondary)}
      aria-disabled={isDisabled}
      onClick={() => {
        if (!isDisabled) onPress();
      }}
    >
      {label}
    </button>
  );
}
