import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { List } from "lucide-react";
import { PageHeader } from "../../components/templates/PageHeader";
import { useDocumentTitle } from "../../shell/use-document-title";
import type { GeographyScope } from "../geography/use-w-15";
import { MapEditorWorkspace } from "./MapEditorWorkspace";

/** Full-page map editor: every quadrant of the organization. */
export function MapEditorScreen({
  scope,
  startTool,
}: {
  scope: GeographyScope;
  startTool?: "quadrant";
}) {
  const { t } = useTranslation();
  useDocumentTitle(t("mapEditor.title"));
  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-4 px-6 pt-5 pb-6">
      <PageHeader
        title={t("mapEditor.title")}
        description={t("mapEditor.description")}
        actions={
          <Link
            to="/quadrants"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-tint"
          >
            <List aria-hidden="true" className="size-4" />
            {t("mapEditor.action.list")}
          </Link>
        }
      />
      <MapEditorWorkspace scope={scope} startTool={startTool} />
    </section>
  );
}
