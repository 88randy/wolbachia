import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { useCan } from "../session/use-can";
import { InventoryCreateGate } from "./InventoryCreateGate";
import type { InventoryKind } from "./inventory-links";
import { InventoryDraftMemory } from "./use-inventory-draft";
import { useInventoryContext } from "./use-inventory-context";
const creation = {
  supplies: ["supply_type.create", "inventory.page.newSupply"],
  lots: ["lot.create", "inventory.page.newLot"],
  locations: ["location.create", "inventory.page.newLocation"],
} as const;
function useCreateAccess(kind: InventoryKind, permission: string) {
  const allowed = useCan()(permission);
  const { identity } = useInventoryContext();
  const memory = useContext(InventoryDraftMemory);
  useEffect(() => {
    if (identity.isSettled && !allowed)
      memory.current = Object.fromEntries(
        Object.entries(memory.current).filter(([key]) => key !== kind + ":new"),
      );
  }, [identity.isSettled, allowed, memory, kind]);
  return allowed;
}
export function InventoryCreateDialog({ kind }: { kind: InventoryKind }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [permission, key] = creation[kind];
  const allowed = useCreateAccess(kind, permission);
  if (!allowed) return null;
  if (kind === "lots")
    return (
      <Button
        onClick={() => {
          void navigate({ to: "/inventory/lots/new" });
        }}
      >
        {t(key)}
      </Button>
    );
  return <CreateDialog kind={kind} title={t(key)} />;
}
function CreateDialog({ kind, title }: { kind: InventoryKind; title: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const onSaved = () => {
    setSaved(true);
    setOpen(false);
  };
  return (
    <>
      <p role="status">{saved ? t("inventory.state.saved") : ""}</p>
      <Dialog
        trigger={<Button>{title}</Button>}
        title={title}
        description={t("inventory.section.identity")}
        open={open}
        onOpenChange={setOpen}
      >
        {open && <InventoryCreateGate kind={kind} onSaved={onSaved} />}
      </Dialog>
    </>
  );
}
