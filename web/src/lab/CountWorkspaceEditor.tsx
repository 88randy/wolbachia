import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../ui/EmptyState";
import { CountEditor } from "./CountEditor";
import { CountShortcuts } from "./CountShortcuts";
import type { Candidate } from "./lab-query";
import styles from "./lab.module.css";

type CountWorkspaceEditorProps = Omit<ComponentProps<typeof CountEditor>, "bag"> & {
  bag: Candidate | null;
  onRetry: () => Promise<void>;
};

export function CountWorkspaceEditor({ bag, onRetry, ...editor }: CountWorkspaceEditorProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.editor}>
      {bag ? (
        <CountEditor {...editor} bag={bag} />
      ) : (
        <EmptyState
          kind="noData"
          message={t("lab.queue.empty")}
          onAction={() => {
            void onRetry();
          }}
          actionLabel={t("common.actions.retry")}
        />
      )}
      <CountShortcuts />
    </div>
  );
}
