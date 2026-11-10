/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useTranslation } from "react-i18next";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { moveMatrixFocus } from "./matrix-keyboard";
interface Props {
  profileId: string;
  permission: string;
  label: string;
  isGranted: boolean;
  canEdit: boolean;
  onEdit: () => void;
}
const CHIP =
  "inline-flex min-h-6 items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-4 font-medium";
/** One permission of a profile: icon + text, never color alone. */
export function PermissionCell(props: Props) {
  const { profileId, permission, label, isGranted, canEdit, onEdit } = props;
  const { t } = useTranslation();
  const text = t(isGranted ? "orgAdmin.roles.granted" : "orgAdmin.roles.denied");
  const Icon = isGranted ? Check : Minus;
  const tone = isGranted
    ? "border-success-fg/30 bg-success-bg text-success-fg"
    : "border-line bg-surface-muted text-ink-2";
  const content = (
    <>
      <Icon aria-hidden="true" className="size-3" />
      {permission}
      <span className="sr-only">{text}</span>
    </>
  );
  if (!canEdit) return <span className={cn(CHIP, tone)}>{content}</span>;
  return (
    <button
      type="button"
      id={`permission-${profileId}-${permission}`}
      data-permission={permission}
      aria-label={`${label}: ${permission} ${text}`}
      aria-pressed={isGranted}
      onKeyDown={moveMatrixFocus}
      onClick={onEdit}
      className={cn(CHIP, tone, "cursor-pointer hover:border-action")}
    >
      {content}
    </button>
  );
}
