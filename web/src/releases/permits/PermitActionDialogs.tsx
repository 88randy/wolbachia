import { PermitDialog } from "./PermitDialog";
import type { Permit } from "./permits-query";
import { SuspendDialog } from "./SuspendDialog";

export type OpenAction = "version" | "suspend" | undefined;

interface Props {
  open: OpenAction;
  permit: Permit;
  onClose: () => void;
}

/** The dialog of the chosen W45 action; closing returns focus to the button that opened it. */
export function PermitActionDialogs({ open, permit, onClose }: Props) {
  if (open === "version")
    return <PermitDialog permit={permit} onClose={onClose} onSaved={onClose} />;
  if (open === "suspend")
    return <SuspendDialog permit={permit} onClose={onClose} onSuspended={onClose} />;
  return null;
}
