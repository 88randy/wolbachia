import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import { useM16 } from "./use-m-16.ts";
import type { M16Model } from "./use-m-16.ts";

const SafetyContext = createContext<M16Model | null>(null);

/** One safety monitor for the whole app: a single local fix stream feeds the lock and the banners. */
export function SafetyProvider({ children }: { readonly children: ReactNode }) {
  const model = useM16();
  return <SafetyContext.Provider value={model}>{children}</SafetyContext.Provider>;
}

export function useSafety(): M16Model {
  const model = useContext(SafetyContext);
  if (model === null) throw new Error("useSafety was called outside SafetyProvider.");
  return model;
}
