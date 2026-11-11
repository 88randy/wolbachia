import type { FeatureRoute } from "./feature-routes.ts";

/**
 * The screens of the app and how a stack of them changes. Pure, so the back rules are tested
 * without a phone. NEW features do not edit this union: they add routes through
 * feature-routes.ts (declaration merging) and screen-registry.ts.
 */
export type Route = FeatureRoute | CoreRoute;

type CoreRoute =
  | {
      readonly name: "ovitrapReplace" | "ovitrapRelocate" | "ovitrapRemove";
      readonly ovitrapId: string;
      readonly manualCapture: boolean;
    }
  | { readonly name: "day" }
  | { readonly name: "qrScanner" }
  | { readonly name: "supplyDetail"; readonly lotId: string }
  | {
      readonly name: "sampleCapture";
      readonly sampleId: string | null;
      readonly sourceRef: {
        readonly kind: "reading" | "lot" | "release";
        readonly id: string;
      } | null;
      readonly manualCapture: boolean;
    }
  | {
      readonly name: "releaseCapture";
      readonly taskId: string | null;
      readonly deviceId: string | null;
      readonly manualCapture: boolean;
    }
  | { readonly name: "map" }
  | { readonly name: "ovitrapCapture"; readonly pointId?: string }
  | {
      readonly name: "ovitrapScanner";
      readonly target: "ovitrap" | "bag" | "label";
      readonly eventId: string | null;
    }
  | { readonly name: "closeShift" }
  | { readonly name: "openShift" }
  | { readonly name: "supplyReceipt" }
  | { readonly name: "fuel" }
  | { readonly name: "incidents" }
  | { readonly name: "emergency" }
  | { readonly name: "home" }
  | { readonly name: "inbox" }
  | { readonly name: "settings" }
  | { readonly name: "history" }
  | { readonly name: "training" }
  | { readonly name: "stylePreview" };

export type RouteName = Route["name"];

export type Stack = readonly [Route, ...Route[]];

export const INITIAL_STACK: Stack = [{ name: "home" }];

export type NavigationAction =
  | { readonly type: "push"; readonly route: Route }
  | { readonly type: "pop" }
  | { readonly type: "popToRoot" }
  | { readonly type: "replace"; readonly route: Route };

/** `push` opens a screen on top; `pop` goes back, but never removes the first screen. */
export function navigationReducer(stack: Stack, action: NavigationAction): Stack {
  if (action.type === "push") {
    const top = stack[stack.length - 1];
    // Pressing the chip twice must not stack the same screen twice.
    return isSameRoute(top, action.route) ? stack : [...stack, action.route];
  }
  const [first, ...rest] = stack;
  if (action.type === "popToRoot") return [first];
  if (action.type === "replace")
    return rest.length === 0 ? [action.route] : [first, ...rest.slice(0, -1), action.route];
  return rest.length === 0 ? stack : [first, ...rest.slice(0, -1)];
}

export function currentRoute(stack: Stack): Route {
  return stack[stack.length - 1] ?? INITIAL_STACK[0];
}

function isSameRoute(left: Route | undefined, right: Route): boolean {
  if (!left || left.name !== right.name) return false;
  if ("lotId" in right) return "lotId" in left && left.lotId === right.lotId;
  if (right.name === "releaseCapture") return isSameRelease(left, right);
  if (right.name === "sampleCapture") return isSameSample(left, right);
  if ("target" in right) return isSameScanner(left, right);
  if ("ovitrapId" in right) return isSameOvitrap(left, right);
  // Routes without params, and every feature route: equal params mean the same screen.
  return JSON.stringify(left) === JSON.stringify(right);
}
function isSameOvitrap(left: Route, right: Route): boolean {
  if (!("ovitrapId" in right)) return true;
  return (
    "ovitrapId" in left &&
    left.ovitrapId === right.ovitrapId &&
    left.manualCapture === right.manualCapture
  );
}
function isSameRelease(left: Route, right: Extract<Route, { name: "releaseCapture" }>): boolean {
  return (
    left.name === "releaseCapture" &&
    left.taskId === right.taskId &&
    left.deviceId === right.deviceId &&
    left.manualCapture === right.manualCapture
  );
}
function isSameSample(left: Route, right: Extract<Route, { name: "sampleCapture" }>): boolean {
  return (
    left.name === "sampleCapture" &&
    left.sampleId === right.sampleId &&
    left.sourceRef?.kind === right.sourceRef?.kind &&
    left.sourceRef?.id === right.sourceRef?.id &&
    left.manualCapture === right.manualCapture
  );
}
function isSameScanner(left: Route, right: Extract<Route, { name: "ovitrapScanner" }>): boolean {
  return "target" in left && left.target === right.target && left.eventId === right.eventId;
}
