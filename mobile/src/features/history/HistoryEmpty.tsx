import { useT } from "../../i18n/I18nProvider.tsx";
import { Card } from "../../ui/Card.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import type { useHistory } from "./use-history.ts";

export function HistoryEmpty({ model }: { readonly model: ReturnType<typeof useHistory> }) {
  const t = useT();
  if (model.view === null && !model.hasError)
    return (
      <Card>
        <Skeleton />
        <Skeleton isShort />
      </Card>
    );
  return (
    <Notice
      tone="info"
      icon="search"
      message={t(model.view?.available ? "mobile.history.noMatches" : "mobile.history.unavailable")}
    />
  );
}
