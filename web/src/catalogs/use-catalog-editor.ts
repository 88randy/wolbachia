import { useCatalogAvailabilityContext } from "./use-catalog-availability-context";
import { useCatalogFeedback } from "./use-catalog-feedback";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { can } from "../session/can";
import { ME_QUERY_KEY } from "../session/me-key";
import type { Me } from "../session/me";
import { isSessionKnown } from "../session/session-revision";

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
  const queryClient = useQueryClient();
  const feedback = useCatalogFeedback();
  const write = useCatalogWrite();
  const view = editorView(slug, items, options);
  const availability = useCatalogAvailabilityContext(view.viewKey, view.isReady, feedback);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const path = (id: string) => ({ catalog_slug: slug, id });
  const save = useCatalogSave(slug, write, items);
  return {
    ...feedback,
    ...availability,
    ...view,
    canChangeAvailability: (isActive: boolean) => hasAvailabilityPermission(queryClient, isActive),
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
/** Read accepted authority at invocation; retained Undo callbacks never capture a permission list. */
function hasAvailabilityPermission(queryClient: QueryClient, isActive: boolean) {
  const me = queryClient.getQueryData<Me>(ME_QUERY_KEY);
  return (
    isSessionKnown() &&
    me !== undefined &&
    can(me, isActive ? "catalog_item.activate" : "catalog_item.deactivate")
  );
}
function editorView(slug: string, items: readonly CatalogItem[], options: Options) {
  return {
    isReady: options.isReady ?? true,
    canReorder: options.canReorder ?? true,
    viewKey: options.viewKey ?? slug,
    displayedVersion:
      options.displayedVersion ?? Math.min(...items.map((item) => item.catalog_version)),
  };
}

export type CatalogEditor = ReturnType<typeof useCatalogEditor>;
