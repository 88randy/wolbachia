import type { useNavigate } from "@tanstack/react-router";
import { applyPatch } from "../../data-table/table-state";
import type { SearchPatch } from "../../data-table/table-types";
export function editorActions(go: (patch: SearchPatch) => void) {
  return {
    edit: (code: string) => {
      go({ editor: code, create: undefined, configure: undefined });
    },
    configure: (code: string) => {
      go({ editor: undefined, create: undefined, configure: code });
    },
    create: () => {
      go({ editor: undefined, create: "1", configure: undefined });
    },
  };
}
export function closeEditor(
  navigate: ReturnType<typeof useNavigate>,
  target: { editor: string; configurationCode: string },
) {
  const focusId = target.editor
    ? `type-edit-${target.editor}`
    : target.configurationCode
      ? `type-configure-${target.configurationCode}`
      : "type-create";
  void navigate({
    to: ".",
    search: (previous) =>
      applyPatch(previous, { editor: undefined, create: undefined, configure: undefined }),
  }).then(() => {
    const destination = document.getElementById(focusId) ?? document.getElementById("type-create");
    destination?.focus();
  });
}
