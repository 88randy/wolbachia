import { useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { replaceAddressBar } from "../router/replace-address-bar";
import { parseResetFragment, RESET_ADDRESS } from "./reset-link";
import type { ResetLink } from "./reset-link";

interface ResetLinkState {
  /** The last link read, or `undefined` when the last fragment was not a usable link. */
  link: ResetLink | undefined;
  /** Changes when the credentials do, so the form can start over. */
  revision: number;
}

function isSame(a: ResetLink | undefined, b: ResetLink | undefined): boolean {
  return a?.uid === b?.uid && a?.token === b?.token;
}

/**
 * Takes every fragment that reaches the page, not only the first: it validates it, keeps the
 * values in memory and clears the address bar at once. A link pasted into the same tab is a
 * hash-only navigation (the page is not remounted), so this listens to the router location and
 * to `hashchange`. An empty fragment (the bar after clearing) changes nothing; a non-empty
 * invalid one replaces the credentials with the invalid-link state.
 */
export function useResetLinkFragment(): ResetLinkState {
  const routerHash = useRouterState({ select: (state) => state.location.hash });
  const [state, setState] = useState<ResetLinkState>({
    link: parseResetFragment(routerHash),
    revision: 0,
  });
  const accept = useCallback((hash: string) => {
    if (hash.replace(/^#/, "") === "") return;
    const link = parseResetFragment(hash);
    replaceAddressBar(RESET_ADDRESS);
    setState((previous) =>
      isSame(previous.link, link) ? previous : { link, revision: previous.revision + 1 },
    );
  }, []);
  useEffect(() => {
    accept(routerHash);
  }, [routerHash, accept]);
  useEffect(() => {
    const onHashChange = () => {
      accept(window.location.hash);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [accept]);
  return state;
}
