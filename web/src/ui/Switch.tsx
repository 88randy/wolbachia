import type { ReactNode } from "react";
interface Props {
  label: ReactNode;
  isOn: boolean;
  disabled?: boolean;
  onChange: (isOn: boolean) => void;
}
/** Native checkbox keyboard behavior with announced switch state and a visible label. */
export function Switch({ label, isOn, disabled, onChange }: Props) {
  return (
    <label className="relative inline-flex min-h-[var(--web-control-md)] cursor-pointer items-center gap-2.5 text-[13px] font-medium has-disabled:cursor-default has-disabled:text-ink-2">
      <input
        type="checkbox"
        role="switch"
        className="peer absolute m-0 h-5 w-9 opacity-0"
        checked={isOn}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <span
        aria-hidden="true"
        className="flex h-5 w-9 flex-none items-center rounded-full border border-line-strong bg-surface-muted p-0.5 transition-colors peer-checked:justify-end peer-checked:border-action peer-checked:bg-action peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-action peer-disabled:opacity-60 peer-checked:[&>span]:bg-on-action"
      >
        <span className="size-3.5 rounded-full bg-ink-2 shadow-xs transition-transform" />
      </span>
      <span>{label}</span>
    </label>
  );
}
