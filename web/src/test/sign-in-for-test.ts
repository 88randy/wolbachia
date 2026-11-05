import type { QueryClient } from "@tanstack/react-query";
import { setExpectedAttestation } from "../session/attestation";
import { recordIdentity } from "../session/identity";
import type { Me } from "../session/me";
import { ME_QUERY_KEY } from "../session/me-query";
import { FAKE_IDENTITY } from "./fake-api";

/**
 * A signed-in session for a test that renders below the router: the identity is recorded, `/me/`
 * is cached and the attestation the fake server uses is the one learned, exactly what an accepted
 * `/me/` leaves behind.
 */
export function signInForTest(queryClient: QueryClient, me: Me): void {
  recordIdentity(queryClient, me);
  queryClient.setQueryData(ME_QUERY_KEY, me);
  setExpectedAttestation(FAKE_IDENTITY);
}
