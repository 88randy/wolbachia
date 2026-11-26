import type { LinkProps } from "@tanstack/react-router";

type Target = Pick<LinkProps, "to" | "params">;

/** The screen that already shows a record of this type, when there is one. */
export function ownScreen(type: string, code: string): Target | null {
  if (type === "incident") return { to: "/incidents/$code", params: { code } };
  if (type === "motorcycle") return { to: "/fleet/motorcycles/$code", params: { code } };
  if (type === "quadrant") return { to: "/quadrants/$code/versions", params: { code } };
  return null;
}

/** W4: the universal history of any record. */
export function historyScreen(type: string, code: string): Target {
  return { to: "/records/$recordType/$code", params: { recordType: type, code } };
}

/** Where a click on a search hit goes: its own screen, or its history when it has none. */
export function openRecord(type: string, code: string): Target {
  return ownScreen(type, code) ?? historyScreen(type, code);
}
