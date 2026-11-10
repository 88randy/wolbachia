import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import type { OwnerFieldController } from "./use-owner-field";
export function TypeOwnerPaging({ controller }: { controller: OwnerFieldController }) {
  const { t } = useTranslation();
  const { page, setPage, query } = controller;
  const previous = () => {
    setPage(page - 1);
  };
  const next = () => {
    setPage(page + 1);
  };
  return (
    <div>
      <Button variant="ghost" disabled={page === 1 || query.isFetching} onClick={previous}>
        {t("table.pager.previous")}
      </Button>
      <Button variant="ghost" disabled={!query.data?.next || query.isFetching} onClick={next}>
        {t("table.pager.next")}
      </Button>
    </div>
  );
}
