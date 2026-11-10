import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { Button } from "../ui/Button";
import { Tooltip } from "../ui/Tooltip";
interface Props {
  label: MessageKey;
  reason: MessageKey | undefined;
  onClick: () => void;
}
/** Blocked actions stay visible and focusable; the reason is announced and shown on hover/focus. */
export function MotorcycleActionButton({ label, reason, onClick }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const button = (
    <Button
      variant="secondary"
      aria-disabled={reason !== undefined}
      aria-describedby={reason === undefined ? undefined : id}
      onClick={() => {
        if (reason === undefined) onClick();
      }}
    >
      {t(label)}
    </Button>
  );
  if (reason === undefined) return button;
  return (
    <>
      <Tooltip content={t(reason)}>{button}</Tooltip>
      <span id={id} className="sr-only">
        {t(reason)}
      </span>
    </>
  );
}
