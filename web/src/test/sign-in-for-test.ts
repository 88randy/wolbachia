import type { QueryClient } from "@tanstack/react-query";
import type { Me } from "../session/me";
import { begin, commitKnown } from "../session/session-controller";
import { FAKE_IDENTITY } from "./fake-api";

/**
 * A signed-in session for a test that renders below the router: what an accepted `/me/` leaves
 * behind (identity recorded, `/me/` cached, the attestation the fake server uses learned), made
 * through the session controller like the app does.
 */
export function signInForTest(queryClient: QueryClient, me: Me): void {
  commitKnown(queryClient, begin(queryClient, "passive"), { me, attestation: FAKE_IDENTITY });
}
