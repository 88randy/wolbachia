import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import { BackHandler } from "react-native";

import { currentRoute, INITIAL_STACK, navigationReducer } from "./routes.ts";
import type { Route } from "./routes.ts";

interface NavigationValue {
  readonly route: Route;
  readonly canGoBack: boolean;
  readonly push: (route: Route) => void;
  readonly goBack: () => void;
}

const NavigationContext = createContext<NavigationValue | null>(null);

export function NavigationProvider({ children }: { readonly children: ReactNode }) {
  const [stack, dispatch] = useReducer(navigationReducer, INITIAL_STACK);
  const push = useCallback((route: Route) => {
    dispatch({ type: "push", route });
  }, []);
  const goBack = useCallback(() => {
    dispatch({ type: "pop" });
  }, []);
  const canGoBack = stack.length > 1;

  // The Android back button pops a screen; on the first screen the system handles it.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack) goBack();
      return canGoBack;
    });
    return () => {
      subscription.remove();
    };
  }, [canGoBack, goBack]);

  const value = useMemo(
    () => ({ route: currentRoute(stack), canGoBack, push, goBack }),
    [stack, canGoBack, push, goBack],
  );
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationValue {
  const value = useContext(NavigationContext);
  if (value === null) throw new Error("useNavigation was called outside NavigationProvider.");
  return value;
}
