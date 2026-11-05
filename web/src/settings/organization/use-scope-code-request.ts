import { useActiveCenter } from "../../centers/use-active-center";
import { useMe } from "../../session/use-me";
import { useApiClient } from "../../api/ApiClientProvider";
import { useAdminWrite } from "./use-admin-write";
import { resolveScopeCode } from "./resolve-scope-code";
/** Resolves within the actor's explicit grants; session failures use the shared guarded path. */
export function useScopeCodeRequest(dimension: "centers" | "quadrants") {
  const client = useApiClient();
  const activeCenter = useActiveCenter();
  const writer = useAdminWrite();
  const grant = useMe().scope[dimension];
  function resolve(code: string) {
    return writer.run(async (guard) => {
      const item = await resolveScopeCode({ dimension, code, client, guard, activeCenter });
      return item && (grant.mode === "all" || grant.ids.includes(item.id)) ? item : null;
    });
  }
  return { resolve, isBusy: writer.isBusy, error: writer.error };
}
