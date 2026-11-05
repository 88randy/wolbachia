import { useNavigate, useSearch } from "@tanstack/react-router";
import type { TableController } from "../../data-table/table-types";
const HISTORY_PAGE = "history_page";
/** Dialog history owns a separate flat URL page; paging never replaces the list's focused row. */
export function useHistoryController(base: TableController, onClose: () => void) {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const parsed = Number(search[HISTORY_PAGE]);
  const page = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
  const goToPage = (next: number) => {
    void navigate({
      to: ".",
      search: (previous) => ({ ...previous, [HISTORY_PAGE]: String(next) }),
    });
  };
  const close = () => {
    onClose();
    void navigate({
      to: ".",
      replace: true,
      search: removeHistoryPage,
    });
  };
  return { controller: { ...base, state: { ...base.state, page }, goToPage }, close };
}

function removeHistoryPage(
  search: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(search).filter(([key]) => key !== HISTORY_PAGE));
}
