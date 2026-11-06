import { useCatalogFeedback } from "./use-catalog-feedback";
import { useState } from "react";

import { useApiClient } from "../api/ApiClientProvider";

import type { CatalogItem } from "./catalogs-query";
import { useCatalogSave } from "./use-catalog-save";
import { useCatalogWrite } from "./use-catalog-write";

export type DialogState = { kind: "create" } | { kind: "edit"; item: CatalogItem };
interface Options {
  isReady?: boolean;
  canReorder?: boolean;
  viewKey?: string;
  displayedVersion?: number;
}

/** Preserve drafts across refreshes while catalog revisions guard conditional reorders. */
export function useCatalogEditor(
  slug: string,
  items: readonly CatalogItem[],
  options: Options = {},
) {
  const client = useApiClient();
  const feedback = useCatalogFeedback();
  const write = useCatalogWrite();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const path = (id: string) => ({ catalog_slug: slug, id });
  const save = useCatalogSave(slug, write, items);
  return {
    ...feedback,
    isReady: options.isReady ?? true,
    canReorder: options.canReorder ?? true,
    viewKey: options.viewKey ?? slug,
    displayedVersion:
      options.displayedVersion ?? Math.min(...items.map((item) => item.catalog_version)),
    dialog,
    setDialog,
    write,
    client,
    path,
    save,
    items,
    slug,
  };
}

export type CatalogEditor = ReturnType<typeof useCatalogEditor>;
