import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import type { AssignmentPanelState } from "./use-assignment-panel";

/** A missing schedule shows no suggestion and no invented quantities. */
export function SuggestionNotice({
  suggestion,
}: {
  suggestion: AssignmentPanelState["suggestion"];
}) {
  const { t } = useTranslation();
  if (suggestion.isError)
    return (
      <InlineNotice
        tone="critical"
        action={
          <Button variant="secondary" size="sm" onClick={() => void suggestion.refetch()}>
            {t("allocation.command.retry")}
          </Button>
        }
      >
        {t("allocation.assignment.suggestionError")}
      </InlineNotice>
    );
  if (!suggestion.data || suggestion.data.status === "assessed") return null;
  const key =
    suggestion.data.status === "unavailable"
      ? "allocation.assignment.noSchedule"
      : "allocation.assignment.unconfigured";
  return <InlineNotice tone="info">{t(key)}</InlineNotice>;
}
