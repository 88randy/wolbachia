import { useEffect, useState } from "react";
import type { Organization } from "./use-w-03";
/** Keep the form mounted while same-identity reauthentication clears queries. W68 keys authorization changes. */
export function useOrganizationSeed(current: Organization | undefined): Organization | undefined {
  const [seed, setSeed] = useState(current);
  useEffect(() => {
    if (current) setSeed(current);
  }, [current]);
  return current ?? seed;
}
