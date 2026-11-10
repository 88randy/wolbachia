import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
interface OptionPagingProps {
  page: number;
  hasNext: boolean;
  onPage: (page: number) => void;
}
export function IncidentOptionPaging({ page, hasNext, onPage }: OptionPagingProps) {
  const { t } = useTranslation();
  return (
    <div>
      <Button
        variant="ghost"
        aria-disabled={page <= 1}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        {t("incidents.workspace.previous")}
      </Button>
      <Button
        variant="ghost"
        aria-disabled={!hasNext}
        onClick={() => {
          onPage(page + 1);
        }}
      >
        {t("incidents.workspace.next")}
      </Button>
    </div>
  );
}
