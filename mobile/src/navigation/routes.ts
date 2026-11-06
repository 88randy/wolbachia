/**
 * The screens of the app and how a stack of them changes. Pure, so the back rules are tested
 * without a phone. Later epics add their routes here (one union member each).
 */
export type Route =
  | {
      readonly name: "ovitrapReplace" | "ovitrapRelocate" | "ovitrapRemove";
      readonly ovitrapId: string;
      readonly manualCapture: boolean;
    }
  | { readonly name: "ovitrapCapture" }
  | { readonly name: "ovitrapScanner"; readonly target: "ovitrap" | "bag" }
  | { readonly name: "invalidOvitrapCode"; readonly target: "ovitrap" | "bag" }
  | { readonly name: "openShift" }
  | { readonly name: "home" }
  | { readonly name: "inbox" }
  | { readonly name: "settings" };

export type RouteName = Route["name"];

export type Stack = readonly [Route, ...Route[]];

export const INITIAL_STACK: Stack = [{ name: "home" }];

export type NavigationAction =
  { readonly type: "push"; readonly route: Route } | { readonly type: "pop" };

/** `push` opens a screen on top; `pop` goes back, but never removes the first screen. */
export function navigationReducer(stack: Stack, action: NavigationAction): Stack {
  if (action.type === "push") {
    const top = stack[stack.length - 1];
    // Pressing the chip twice must not stack the same screen twice.
    return isSameRoute(top, action.route) ? stack : [...stack, action.route];
  }
  const [first, ...rest] = stack;
  return rest.length === 0 ? stack : [first, ...rest.slice(0, -1)];
}

export function currentRoute(stack: Stack): Route {
  return stack[stack.length - 1] ?? INITIAL_STACK[0];
}

function isSameRoute(left: Route | undefined, right: Route): boolean {
  if (!left || left.name !== right.name) return false;
  if (!("ovitrapId" in right)) return true;
  return (
    "ovitrapId" in left &&
    left.ovitrapId === right.ovitrapId &&
    left.manualCapture === right.manualCapture
  );
}
