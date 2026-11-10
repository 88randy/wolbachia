import { CountSavedNotice } from "./CountSavedNotice";
import type { TableController } from "../data-table/table-types";
import { CountWorkspaceLayout } from "./CountWorkspaceLayout";
import { CountWorkspaceEditor } from "./CountWorkspaceEditor";
import { useCountWorkspace } from "./use-count-workspace";
import type { Candidate, LabScope } from "./lab-query";
interface WorkspaceProps {
  scope: LabScope;
  draftKey: string;
  controller: TableController;
  initial: Candidate | null;
}
/** Background queue updates never replace the bag someone is actively counting. */
export function CountWorkspaceBody({ scope, draftKey, controller, initial }: WorkspaceProps) {
  const state = useCountWorkspace({ scope, controller, initial });
  return (
    <>
      <CountSavedNotice code={state.savedCode} />
      <CountWorkspaceLayout
        scope={scope}
        controller={controller}
        select={state.select}
        isLocked={state.isLocked}
      >
        <CountWorkspaceEditor
          bag={state.bag}
          scope={scope}
          draftKey={draftKey}
          controller={controller}
          onLockChange={state.setLocked}
          onSaved={state.onSaved}
          onRetry={state.retry}
        />
      </CountWorkspaceLayout>
    </>
  );
}
