import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../../session/use-can";
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
  const canConfigure = useCan()("supply_type.update");
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
  if (suggestion.data.status === "unavailable")
    return <InlineNotice tone="info">{t("allocation.assignment.noSchedule")}</InlineNotice>;
  return (
    <InlineNotice tone="info">
      <p className="m-0">{t("allocation.assignment.unconfigured")}</p>
      {canConfigure && (
        <Link to="/inventory/supplies" className="font-semibold">
          {t("allocation.assignment.configureLink")}
        </Link>
      )}
    </InlineNotice>
  );
}
