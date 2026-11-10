import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { PermitActionButton } from "./PermitActionButton";
import { PermitActionDialogs } from "./PermitActionDialogs";
import type { OpenAction } from "./PermitActionDialogs";
import type { Permit } from "./permits-query";
import styles from "./permits.module.css";

/**
 * Actions of W45. No permission: hidden. Allowed but blocked by state (already suspended):
 * disabled, with the reason next to it. A suspension is never edited or undone here.
 */
export function PermitActions({ permit }: { permit: Permit }) {
  const { t } = useTranslation();
  const reasonId = useId();
  const [open, setOpen] = useState<OpenAction>();
  const blockedBy = permit.suspension ? reasonId : undefined;
  return (
    <div className={styles.actions}>
      <PermitActionButton action="version" blockedBy={blockedBy} onOpen={setOpen} />
      <PermitActionButton action="suspend" blockedBy={blockedBy} onOpen={setOpen} />
      {blockedBy && (
        <p id={reasonId} className={styles.muted}>
          {t("permits.suspend.blockedAlready")}
        </p>
      )}
      <PermitActionDialogs
        open={open}
        permit={permit}
        onClose={() => {
          setOpen(undefined);
        }}
      />
    </div>
  );
}
