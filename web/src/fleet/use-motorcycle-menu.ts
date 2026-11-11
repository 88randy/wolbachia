import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import type { OverflowAction } from "../components/templates/OverflowMenu";
import type { useMotorcycleActions } from "./use-motorcycle-actions";

const SHORT_REASON: Partial<Record<MessageKey, MessageKey>> = {
  "fleet.record.refreshRequired": "fleet.menu.needsRefresh",
  "fleet.action.voided": "fleet.menu.voided",
  "fleet.action.notBlocked": "fleet.menu.notBlocked",
};

interface Item {
  id: string;
  label: MessageKey;
  reason: MessageKey | undefined;
  onSelect: () => void;
  destructive?: boolean;
}

function useItem() {
  const { t } = useTranslation();
  return (item: Item): OverflowAction => {
    const short = item.reason === undefined ? undefined : SHORT_REASON[item.reason];
    const label = t(item.label);
    return {
      id: item.id,
      label:
        short === undefined ? label : t("fleet.menu.reason", { action: label, reason: t(short) }),
      onSelect: item.onSelect,
      disabled: item.reason !== undefined,
      destructive: item.destructive ?? false,
    };
  };
}

/** The "⋯" menu of the record: refresh, unblock and void; a blocked one says why. */
export function useMotorcycleMenu(
  actions: ReturnType<typeof useMotorcycleActions>,
  onRefresh: () => void,
): OverflowAction[] {
  const { t } = useTranslation();
  const item = useItem();
  const menu: OverflowAction[] = [
    { id: "refresh", label: t("fleet.action.refresh"), onSelect: onRefresh },
  ];
  if (actions.canUnblock)
    menu.push(
      item({
        id: "unblock",
        label: "fleet.unblock.confirm",
        reason: actions.unblockReason,
        onSelect: actions.openUnblock,
      }),
    );
  if (actions.canVoid)
    menu.push(
      item({
        id: "void",
        label: "common.actions.void",
        reason: actions.reason,
        onSelect: actions.openVoid,
        destructive: true,
      }),
    );
  return menu;
}
