import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MapEditor } from "./use-map-editor";

/** One plain sentence about what to do next, announced politely as the tool changes. */
export function EditorStatusLine({ editor }: { editor: MapEditor }) {
  const { t } = useTranslation();
  let message: string;
  if (editor.tool === "quadrant")
    message =
      editor.vertexCount > 0
        ? t("mapEditor.status.quadrantCorners", { count: editor.vertexCount })
        : t("mapEditor.status.quadrant");
  else if (editor.tool === "sampling") message = t("mapEditor.status.sampling");
  else if (editor.tool === "release") message = t("mapEditor.status.release");
  else if (editor.selected)
    message = t(
      editor.selected.kind === "quadrant"
        ? "mapEditor.status.selectQuadrant"
        : "mapEditor.status.selectPoint",
    );
  else message = t("mapEditor.status.select");
  return (
    <p
      role="status"
      className="m-0 flex min-h-[3.75rem] items-start gap-2 rounded-xl bg-tint px-3.5 py-2.5 text-[13px] leading-5 text-action-strong"
    >
      <Info aria-hidden="true" className="mt-0.5 size-4 flex-none" />
      {message}
    </p>
  );
}
