import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { useDocumentTitle } from "../shell/use-document-title";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useReceptionScope } from "./use-reception-scope";
import { useReceptionCommand } from "./use-reception-command";
import { RECEPTION_TABLE, RECEPTION_URL_SCOPE } from "./reception-table";
import type { ReceptionView } from "./reception-table";

function receptionView(value: unknown): ReceptionView {
  if (value === "expected" || value === "discrepancies" || value === "noPaddle") return value;
  return "received";
}

/** URL view changes retain the shared filters and reset only paging. */
export function useReceptionWorkspace() {
  const { t } = useTranslation();
  const scope = useReceptionScope();
  const can = useCan();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const controller = useTableUrlState(RECEPTION_TABLE, RECEPTION_URL_SCOPE);
  const actions = useReceptionCommand(scope);
  useDocumentTitle(t("labReception.page.title"));
  return {
    controller,
    actions,
    view: receptionView(search["view"]),
    canRead: can("reading.read"),
    canCount: can("egg_count.create"),
    changeView: (view: string) => {
      void navigate({ to: ".", search: (previous) => ({ ...previous, view, page: undefined }) });
    },
  };
}
