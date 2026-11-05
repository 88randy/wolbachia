import { useTranslation } from "react-i18next";
import type { GeographyScope } from "./use-w-15";
import { GeographyLoadError } from "./GeographyLoadError";
import { PendingState } from "../../states/PendingState";
import { ProposalSnapshot } from "./ProposalSnapshot";
import { useReviewedProposals } from "./use-reviewed-proposals";
interface Props {
  scope: GeographyScope;
  quadrant: string;
}
export function BlockSuggestions({ scope, quadrant }: Props) {
  const { t } = useTranslation();
  const { query, proposals } = useReviewedProposals(scope, quadrant);
  const retry = () => {
    void query.refetch();
  };
  if (!proposals && query.isPending) return <PendingState />;
  if (!proposals) return <GeographyLoadError error={query.error} retry={retry} />;
  return (
    <section>
      {query.error && <GeographyLoadError error={query.error} retry={retry} />}
      <p role="status">{t("geography.status.review")}</p>
      <ProposalSnapshot {...{ scope, quadrant, proposals }} />
      {!proposals.length && <p>{t("geography.blocks.empty")}</p>}
    </section>
  );
}
