import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { useApiClient } from "../api/ApiClientProvider";
import { useLanguage } from "../i18n/use-language";

import type { CatalogItem } from "./catalogs-query";
import { useCatalogSave } from "./use-catalog-save";
import { useCatalogWrite } from "./use-catalog-write";

export type DialogState = { kind: "create" } | { kind: "edit" | "deactivate"; item: CatalogItem };

/** Non-atomic PATCH swaps may partially succeed. Refetch after any failure; never fake rollback. */
export function useCatalogEditor(slug: string, items: readonly CatalogItem[]) {
  const client = useApiClient();
  const write = useCatalogWrite();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const path = (id: string) => ({ catalog_slug: slug, id });
  const save = useCatalogSave(slug, write, items);
  const state = {
    dialog,
    setDialog,
    error,
    setError,
    announcement,
    setAnnouncement,
    write,
    client,
    path,
    t,
    language,
  };
  return { ...state, save, items, slug };
}

/** A fixed item has no controls; permitted state changes use the action endpoints with no body. */
export async function changeAvailability(editor: CatalogEditor, item: CatalogItem) {
  const outcome = await editor.write.run((guard) =>
    editor.write.send(
      () =>
        item.is_active
          ? editor.client.POST("/api/v1/catalogs/{catalog_slug}/items/{id}/deactivate/", {
              params: { path: editor.path(item.id) },
              signal: guard.signal,
            })
          : editor.client.POST("/api/v1/catalogs/{catalog_slug}/items/{id}/activate/", {
              params: { path: editor.path(item.id) },
              signal: guard.signal,
            }),
      guard,
    ),
  );
  if (outcome.kind === "stale") return;
  if (outcome.kind === "failed") editor.setError(outcome.key);
  else {
    editor.setDialog(null);
    editor.setAnnouncement(editor.t("catalogs.actions.saved"));
  }
}

export type CatalogEditor = ReturnType<typeof useCatalogEditor>;
