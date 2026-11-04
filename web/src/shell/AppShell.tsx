import { Outlet } from "@tanstack/react-router";

/** Provisional frame (sidebar and top bar come next): the page lives in the main landmark. */
export function AppShell() {
  return (
    <main id="main" tabIndex={-1}>
      <Outlet />
    </main>
  );
}
