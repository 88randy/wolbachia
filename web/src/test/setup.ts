import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";
import { afterEach, expect } from "vitest";
import { resetAuthOperation } from "../session/auth-operation";
import { resetSessionRevision } from "../session/session-revision";

// jest-axe works under Vitest with this shim (vitest-axe is stale, see ADR 0001).
expect.extend(toHaveNoViolations);

// Vitest has no globals by default, so Testing Library's automatic cleanup does not run.
afterEach(cleanup);
// Sign-in and sign-out share a lock in module state; no test may leave it held.
afterEach(resetAuthOperation);
afterEach(resetSessionRevision);

// jsdom does not implement scrolling; the router calls it on navigation and logs noise otherwise.
window.scrollTo = () => undefined;

// jsdom does not implement <dialog> modality. The shim opens and closes it like the browser does
// (the `open` attribute and the `close` event); focus trapping is checked in the e2e tests.
if (typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

declare module "vitest" {
  interface Assertion {
    toHaveNoViolations(): void;
  }
}
