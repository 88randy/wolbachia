import { Button } from "../ui/Button";
import type { ButtonProps } from "../ui/Button";
import { Tooltip } from "../ui/Tooltip";
interface Props extends ButtonProps {
  reason: string | undefined;
  label?: string;
}
/** Blocked icon controls remain focusable so keyboard users can read the explanation. */
export function CatalogActionButton({ reason, label, ...button }: Props) {
  return (
    <Tooltip content={reason ?? label ?? button.children}>
      <Button
        {...button}
        variant={button.variant ?? "ghost"}
        size={button.size ?? "sm"}
        aria-label={label}
        aria-disabled={reason !== undefined}
        onClick={(event) => {
          if (reason === undefined) button.onClick?.(event);
        }}
      />
    </Tooltip>
  );
}
