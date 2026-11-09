import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../ui/EmptyState";
import type { TableController } from "../data-table/table-types";
import { CountQueue } from "./CountQueue";
import { CountEditor } from "./CountEditor";
import { CountShortcuts } from "./CountShortcuts";
import { queueOptions } from "./lab-query";
import type { Candidate, LabScope } from "./lab-query";
import styles from "./lab.module.css";
interface WorkspaceProps { scope: LabScope; draftKey: string; controller: TableController; initial: Candidate | null }
/** Background queue updates never replace the bag someone is actively counting. */
export function CountWorkspaceBody({ scope, draftKey, controller, initial }: WorkspaceProps) {
  const { t } = useTranslation();
  const query = useQuery(queueOptions(scope, controller.state));
  const [bag, select] = useState(initial);
  const [isSaved, setSaved] = useState(false);
  const [isLocked, setLocked] = useState(false);
  const retry = async () => { const answer = await query.refetch(); if (answer.data) select(answer.data.results[0] ?? null); };
  return (
    <>
      <p role="status">{isSaved ? t("lab.count.saved") : ""}</p>
      <div className={styles.workspace}>
        <fieldset className={styles.queue} disabled={isLocked}>
          <legend>{t("lab.queue.title")}</legend>
          <CountQueue scope={scope} controller={controller} select={select} />
        </fieldset>
        <div className={styles.editor}>
          {bag ? <CountEditor bag={bag} scope={scope} draftKey={draftKey} controller={controller} onLockChange={setLocked}
            onSaved={(outcome) => { setLocked(false); select(outcome.next_bag); setSaved(true); }} />
            : <EmptyState kind="noData" message={t("lab.queue.empty")} onAction={() => { void retry(); }} actionLabel={t("common.actions.retry")} />}
          <CountShortcuts />
        </div>
      </div>
    </>
  );
}
