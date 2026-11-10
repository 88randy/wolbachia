import type { IncidentType, TypeTarget, TypeScope } from "./incident-types-query";
import { useTypeDraft } from "./use-type-draft";
import { useTypeWrite } from "./use-type-write";
interface Options {
  scope: TypeScope;
  item?: TypeTarget;
  review: () => Promise<IncidentType | undefined>;
  onSaved?: (item: IncidentType) => void;
}
/** Drafts remain in RAM across refused writes and refreshes, with an explicit revision review. */
export function useTypeForm({ scope, item, review, onSaved }: Options) {
  const state = useTypeDraft(item);
  const writer = useTypeWrite(scope, onSaved);
  async function save() {
    const saved = await writer.save(state.draft, item);
    if (saved && onSaved) state.adoptRevision(saved.revision);
    else if (saved) state.saved(saved.revision);
  }
  async function reviewCurrent() {
    const current = await review();
    if (current) {
      state.adoptRevision(current.revision);
      writer.reviewed();
    }
  }
  return { ...state, save, reviewCurrent, writer };
}
export type TypeFormController = ReturnType<typeof useTypeForm>;
