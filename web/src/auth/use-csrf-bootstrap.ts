import { useEffect } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import { ensureCsrfCookie } from "../api/csrf";

/**
 * Asks for the CSRF cookie when a public form opens, so the first submit already has it. Failing
 * here is fine: the submit asks again and reports the problem to the user.
 */
export function useCsrfBootstrap(): void {
  const client = useApiClient();
  useEffect(() => {
    ensureCsrfCookie(client).catch((error: unknown) => {
      console.warn("Could not prepare the CSRF cookie yet; the submit will retry", error);
    });
  }, [client]);
}
