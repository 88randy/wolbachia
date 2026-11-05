import { useActiveCenter } from "../../centers/use-active-center";
import { useState } from "react";
import { useMe } from "../../session/use-me";
import { useApiClient } from "../../api/ApiClientProvider";
import { useAdminWrite } from "./use-admin-write";
import { resolveScopeCode } from "./resolve-scope-code";
/** Unknown and foreign codes share one result; session failures use the guarded request path. */
export function useScopeCode(dimension: "centers" | "quadrants", onAdd: (id: string) => void) {
  const client = useApiClient();
  const activeCenter = useActiveCenter();
  const writer = useAdminWrite();
  const grant = useMe().scope[dimension];
  const [code, setCode] = useState("");
  const [isMissing, setMissing] = useState(false);
  async function add() {
    setMissing(false);
    const item = await writer.run((guard) =>
      resolveScopeCode({ dimension, code, client, guard, activeCenter }),
    );
    if (!item || (grant.mode !== "all" && !grant.ids.includes(item.id))) {
      setMissing(true);
      return;
    }
    onAdd(item.id);
    setCode("");
  }
  return { code, setCode, add, isMissing, isBusy: writer.isBusy };
}
