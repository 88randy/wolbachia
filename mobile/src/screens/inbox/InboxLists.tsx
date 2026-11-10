import { CircleCheck } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import type { InboxModel } from "../../sync/inbox-model.ts";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { GroupSection } from "./GroupSection.tsx";
import { InboxSection } from "./InboxSection.tsx";
import { ProblemCard } from "./ProblemCard.tsx";

/**
 * The three sections of the inbox, grouped by type: what has a problem, what is still on the
 * phone, what was sent. There is no delete anywhere: records are only ever corrected by voiding.
 */
export function InboxLists({ model }: { readonly model: InboxModel | null }) {
  const t = useT();
  if (model === null) return null;
  const { problems, onPhone, sent } = model;
  if (problems.length + onPhone.length + sent.length === 0) {
    return <EmptyState icon={CircleCheck} title={t("mobile.inbox.empty")} />;
  }
  return (
    <>
      {problems.length === 0 ? null : (
        <InboxSection title={t("mobile.inbox.problems")}>
          {problems.map((item) => (
            <ProblemCard key={item.id} item={item} />
          ))}
        </InboxSection>
      )}
      <GroupSection
        title={t("mobile.inbox.onPhone", { count: model.onPhoneTotal })}
        groups={onPhone}
      />
      <GroupSection title={t("mobile.inbox.sent", { count: model.sentTotal })} groups={sent} />
    </>
  );
}
