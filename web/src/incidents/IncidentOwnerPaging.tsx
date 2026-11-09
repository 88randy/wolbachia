import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { IncidentReassignment } from "./use-incident-reassign";

export function IncidentOwnerPaging({ controller }: { controller: IncidentReassignment }) {
  const { t } = useTranslation();
  const { capture, query, changePage } = controller;
  const previous = () => {
    changePage(capture.page - 1);
  };
  const next = () => {
    changePage(capture.page + 1);
  };
  return (
    <>
      <Button
        variant="secondary"
        aria-disabled={capture.page <= 1 || query.isFetching}
        onClick={previous}
      >
        {t("incidents.workspace.previous")}
      </Button>
      <Button
        variant="secondary"
        aria-disabled={!query.data?.next || query.isFetching}
        onClick={next}
      >
        {t("incidents.workspace.next")}
      </Button>
    </>
  );
}
