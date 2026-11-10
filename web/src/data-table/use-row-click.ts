import { useNavigate } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import type { MouseEvent } from "react";

const INTERACTIVE = "a, button, input, select, textarea, label, [role=checkbox], [role=menuitem]";

/**
 * Row click opens the record. Clicks on links, buttons and controls inside the row keep their
 * own behavior; keyboard users reach the record through its code link (the row is not a button).
 */
export function useRowClick(link: LinkProps | undefined) {
  const navigate = useNavigate();
  if (!link) return undefined;
  return (event: MouseEvent<HTMLTableRowElement>) => {
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    if (window.getSelection()?.toString()) return;
    void navigate(link as Parameters<typeof navigate>[0]);
  };
}
