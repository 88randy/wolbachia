import { useSyncExternalStore } from "react";

import { useServices } from "../app/services-context.ts";

/** First name of the signed-in courier from the saved profile, or null when unknown. */
export function useFirstName(): string | null {
  const { auth } = useServices();
  const snapshot = useSyncExternalStore(auth.subscribe, auth.getSnapshot);
  const name = snapshot.profile?.firstName.trim() ?? "";
  return name === "" ? null : name;
}
