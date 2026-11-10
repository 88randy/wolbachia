import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { Button } from "../../ui/Button";
import type { AssignmentPanelState } from "./use-assignment-panel";
import styles from "../inventory.module.css";

function BlockerList({ id, keys }: { id: string; keys: readonly MessageKey[] }) {
  const { t } = useTranslation();
  return (
    <ul id={id}>
      {keys.map((key) => (
        <li key={key}>{t(key)}</li>
      ))}
    </ul>
  );
}

/** Save the delivery, or send the saved assignment to the courier's phone for signature. */
export function AssignmentActions({ panel }: { panel: AssignmentPanelState }) {
  const { t } = useTranslation();
  const id = useId();
  const { command, draft } = panel;
  if (panel.saved)
    return (
      <Button
        loading={command.isBusy}
        disabled={command.result?.kind === "release"}
        onClick={panel.release}
      >
        {t("allocation.assignment.release")}
      </Button>
    );
  const isBlocked = draft.blockers.length > 0;
  return (
    <div className={styles.actions}>
      <Button
        loading={command.isBusy}
        aria-disabled={isBlocked || undefined}
        aria-describedby={isBlocked ? id : undefined}
        onClick={panel.create}
      >
        {t("allocation.assignment.create")}
      </Button>
      {isBlocked && <BlockerList id={id} keys={draft.blockers} />}
    </div>
  );
}
