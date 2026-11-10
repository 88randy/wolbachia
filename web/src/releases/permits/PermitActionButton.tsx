import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { can } from "../../session/can";
import { useMe } from "../../session/use-me";
import { Button } from "../../ui/Button";
import { PERMIT_MANAGE, PERMIT_SUSPEND } from "./permissions";
import type { OpenAction } from "./PermitActionDialogs";

type Action = NonNullable<OpenAction>;

const ACTIONS: Record<
  Action,
  { permission: string; label: MessageKey; variant: "primary" | "secondary" }
> = {
  version: { permission: PERMIT_MANAGE, label: "permits.detail.newVersion", variant: "secondary" },
  suspend: { permission: PERMIT_SUSPEND, label: "permits.suspend.action", variant: "primary" },
};

interface Props {
  action: Action;
  /** Allowed but blocked by state: disabled and described by the element with this id. */
  blockedBy: string | undefined;
  onOpen: (action: Action) => void;
}

/** No permission: not rendered. Blocked by state: disabled and tied to its visible reason. */
export function PermitActionButton({ action, blockedBy, onOpen }: Props) {
  const { t } = useTranslation();
  const spec = ACTIONS[action];
  if (!can(useMe(), spec.permission)) return null;
  return (
    <Button
      variant={spec.variant}
      disabled={blockedBy !== undefined}
      aria-describedby={blockedBy}
      onClick={() => {
        onOpen(action);
      }}
    >
      {t(spec.label)}
    </Button>
  );
}
