import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { DialogFooter } from "../../ui/DialogFooter";
import { useToast } from "../../ui/toast-context";
import { useLabScope } from "../use-lab-scope";
import { pcrErrorKey } from "./pcr-api";
import type { ExternalLab } from "./pcr-api";

interface LabDialogProps {
  trigger: ReactNode;
  lab?: ExternalLab;
  onSaved?: (lab: ExternalLab) => void;
}

/** Create or edit one external laboratory (name, contact, address). */
export function LabDialog({ trigger, lab, onSaved }: LabDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      trigger={trigger}
      title={t(lab ? "pcr.labs.edit" : "pcr.labs.new")}
      description={t("pcr.labs.formDescription")}
      open={open}
      onOpenChange={setOpen}
    >
      {open && (
        <LabForm
          lab={lab}
          onDone={(saved) => {
            setOpen(false);
            onSaved?.(saved);
          }}
          onCancel={() => {
            setOpen(false);
          }}
        />
      )}
    </Dialog>
  );
}

function LabForm({
  lab,
  onDone,
  onCancel,
}: {
  lab: ExternalLab | undefined;
  onDone: (lab: ExternalLab) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const scope = useLabScope();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [name, setName] = useState(lab?.name ?? "");
  const [contact, setContact] = useState(lab?.contact ?? "");
  const [address, setAddress] = useState(lab?.address ?? "");
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        contact: contact.trim(),
        address: address.trim(),
        is_active: lab?.is_active ?? true,
      };
      if (lab)
        return unwrap(
          await scope.client.PATCH("/api/v1/external-labs/{id}/", {
            params: { path: { id: lab.id } },
            body,
          }),
        );
      return unwrap(await scope.client.POST("/api/v1/external-labs/", { body }));
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries();
      showToast({ message: t("pcr.labs.saved"), tone: "success" });
      onDone(saved);
    },
    onError: (caught) => {
      setError(t(pcrErrorKey(caught)));
    },
  });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) save.mutate();
      }}
    >
      <TextField
        id="pcr-lab-name"
        label={t("pcr.labs.name")}
        value={name}
        maxLength={200}
        required
        error={error}
        onChange={(event) => {
          setName(event.currentTarget.value);
          setError(undefined);
        }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="pcr-lab-contact"
          label={t("pcr.labs.contact")}
          value={contact}
          maxLength={200}
          onChange={(event) => {
            setContact(event.currentTarget.value);
          }}
        />
        <TextField
          id="pcr-lab-address"
          label={t("pcr.labs.address")}
          value={address}
          maxLength={500}
          onChange={(event) => {
            setAddress(event.currentTarget.value);
          }}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("common.actions.cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t("common.actions.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
