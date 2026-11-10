import { useNavigate, useSearch } from "@tanstack/react-router";
import { applyPatch } from "../../data-table/table-state";
import type { SearchPatch } from "../../data-table/table-types";
import { editorActions, closeEditor } from "./type-navigation";
import { useCallback, useMemo } from "react";
export function useTypeNavigation() {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const editor = typeof search["editor"] === "string" ? search["editor"] : "";
  const configurationCode = typeof search["configure"] === "string" ? search["configure"] : "";
  const go = useCallback(
    (patch: SearchPatch) => {
      void navigate({ to: ".", search: (previous) => applyPatch(previous, patch) });
    },
    [navigate],
  );
  const actions = useMemo(() => editorActions(go), [go]);
  const close = () => {
    closeEditor(navigate, { editor, configurationCode });
  };
  return {
    editor,
    configurationCode,
    isCreating: search["create"] === "1",
    ...actions,
    close,
  };
}
