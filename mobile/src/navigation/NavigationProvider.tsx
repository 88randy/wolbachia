import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import { BackHandler } from "react-native";

import { useServices } from "../app/services-context.ts";

import { currentRoute, INITIAL_STACK, navigationReducer } from "./routes.ts";
import type { NavigationAction, Route } from "./routes.ts";

interface NavigationValue {
  readonly route: Route;
  readonly canGoBack: boolean;
  readonly push: (route: Route) => void;
  readonly goBack: () => void;
  /** Back to the first screen (home), for example after "Listo" at the end of a flow. */
  readonly popToRoot: () => void;
  /** Swaps the top screen, so Back skips a finished wizard step. */
  readonly replace: (route: Route) => void;
}

const NavigationContext = createContext<NavigationValue | null>(null);

function useStackActions(dispatch: (action: NavigationAction) => void) {
  return useMemo(
    () => ({
      push: (route: Route) => {
        dispatch({ type: "push", route });
      },
      goBack: () => {
        dispatch({ type: "pop" });
      },
      popToRoot: () => {
        dispatch({ type: "popToRoot" });
      },
      replace: (route: Route) => {
        dispatch({ type: "replace", route });
      },
    }),
    [dispatch],
  );
}

export function NavigationProvider({ children }: { readonly children: ReactNode }) {
  const { auth } = useServices();
  const [stack, dispatch] = useReducer(navigationReducer, INITIAL_STACK);
  const { push, goBack, popToRoot, replace } = useStackActions(dispatch);
  const canGoBack = stack.length > 1;

  // The Android back button pops a screen; on the first screen the system handles it.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (auth.getSnapshot().phase !== "unlocked") return true;
      if (canGoBack) goBack();
      return canGoBack;
    });
    return () => {
      subscription.remove();
    };
  }, [auth, canGoBack, goBack]);

  const value = useMemo(
    () => ({ route: currentRoute(stack), canGoBack, push, goBack, popToRoot, replace }),
    [stack, canGoBack, push, goBack, popToRoot, replace],
  );
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationValue {
  const value = useContext(NavigationContext);
  if (value === null) throw new Error("useNavigation was called outside NavigationProvider.");
  return value;
}
