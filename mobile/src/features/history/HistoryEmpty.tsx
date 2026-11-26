import { History } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import type { useHistory } from "./use-history.ts";

export function HistoryEmpty({ model }: { readonly model: ReturnType<typeof useHistory> }) {
  const t = useT();
  if (model.view === null && !model.hasError)
    return (
      <>
        <Skeleton />
        <Skeleton isShort />
      </>
    );
  return (
    <EmptyState
      icon={History}
      title={t(model.view?.available ? "mobile.history.noMatches" : "mobile.history.unavailable")}
    />
  );
}
