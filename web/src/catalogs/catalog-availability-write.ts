import type { SessionGuard } from "../session/use-session-guard";
import type { Schemas } from "@wolbachia/api-client";
import type { CatalogEditor } from "./use-catalog-editor";
import type { CatalogItem } from "./catalogs-query";

export interface AvailabilityIntent {
  readonly path: Readonly<{ catalog_slug: string; id: string }>;
  readonly isActive: boolean;
  readonly version: number;
}
function receiptOf(item: CatalogItem | undefined, intent: AvailabilityIntent) {
  if (!item || item.id !== intent.path.id || item.is_active !== intent.isActive) return;
  const version = item.catalog_version;
  if (!Number.isSafeInteger(version) || version < intent.version) return;
  return { ...intent, version };
}
/** Keep the response revision before the write owner awaits invalidation/newer reads. */
export async function writeAvailability(
  editor: CatalogEditor,
  intent: AvailabilityIntent,
  origin: SessionGuard,
) {
  let receipt: AvailabilityIntent | undefined;
  let uncertain = true;
  const outcome = await editor.write.run((guard) =>
    editor.write.send(
      async () => {
        const result = await postAvailability(editor, intent, guard.signal);
        receipt = result.response.ok ? receiptOf(result.data, intent) : undefined;
        uncertain = result.response.ok ? receipt === undefined : result.response.status >= 500;
        return result;
      },
      { signal: guard.signal, isStale: () => guard.isStale() || origin.isStale() },
    ),
  );
  return { outcome, receipt, uncertain };
}
function postAvailability(editor: CatalogEditor, intent: AvailabilityIntent, signal: AbortSignal) {
  const options = {
    params: { path: intent.path },
    body: { version: intent.version } satisfies Schemas["CatalogAvailabilityRequest"],
    signal,
  };
  return intent.isActive
    ? editor.client.POST("/api/v1/catalogs/{catalog_slug}/items/{id}/activate/", options)
    : editor.client.POST("/api/v1/catalogs/{catalog_slug}/items/{id}/deactivate/", options);
}
