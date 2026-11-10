import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { LifecycleBlocked } from "./LifecycleBlocked.tsx";
import { LifecycleDone } from "./LifecycleDone.tsx";
import { LifecycleWizard } from "./LifecycleWizard.tsx";
import type { StartInput } from "./new-draft.ts";
import { useAutoBegin } from "./use-auto-begin.ts";
import { useM09 } from "./use-m-09.ts";

/** Replace, move or retire an ovitrap: starts by itself, asks one thing per page, then confirms. */
export function LifecycleScreen(input: StartInput) {
  const model = useM09();
  const t = useT();
  useAutoBegin(model, input);
  const state = model.state;
  const draft = state?.draft;
  if (state && draft && state.event) return <LifecycleDone model={model} draft={draft} />;
  if (state && draft && !state.isShiftBlocked && !state.isScopeBlocked)
    return <LifecycleWizard key={draft.eventId} model={model} draft={draft} />;
  return (
    <ScreenScaffold header={<AppHeader title={t(`field.lifecycle.kind.${input.kind}`)} />}>
      {state === null ? (
        <Skeleton />
      ) : (
        <LifecycleBlocked
          model={model}
          retry={() => {
            void model.run(
              () => model.service.start(input, draft?.eventId ?? null),
              draft?.eventId ?? null,
              true,
            );
          }}
        />
      )}
    </ScreenScaffold>
  );
}
