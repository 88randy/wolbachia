import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";
import { afterEach, expect } from "vitest";
import { installComboboxSelectOptions } from "./combobox-select-options";
import { resetAuthOperation } from "../session/auth-operation";
import { resetAttestation } from "../session/attestation";
import { uninstallSessionSync } from "../session/install-session-sync";
import { resetSessionRevision } from "../session/session-revision";

// jest-axe works under Vitest with this shim (vitest-axe is stale, see ADR 0001).
expect.extend(toHaveNoViolations);

// Vitest has no globals by default, so Testing Library's automatic cleanup does not run.
afterEach(cleanup);
// Sign-in and sign-out share a lock in module state; no test may leave it held.
afterEach(resetAuthOperation);
afterEach(resetSessionRevision);
// The app root installs the session sync; none may outlive its test.
afterEach(() => {
  uninstallSessionSync();
  resetAttestation();
});

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

// jsdom has no layout observer or element scrolling; cmdk needs both for its list.
if (typeof globalThis.ResizeObserver !== "function") {
  globalThis.ResizeObserver = class {
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  };
}
if (typeof HTMLElement.prototype.scrollIntoView !== "function") {
  HTMLElement.prototype.scrollIntoView = () => undefined;
}

// jsdom has no Web Animations implementation; dnd-kit finishes existing browser animations
// before measuring a row. There are no animations to finish in this environment.
if (typeof Document.prototype.getAnimations !== "function") {
  Document.prototype.getAnimations = () => [];
}
if (typeof Element.prototype.getAnimations !== "function") {
  Element.prototype.getAnimations = () => [];
}

// Layout observation is browser-owned. Unit tests provide row rectangles for drag geometry.
if (typeof globalThis.IntersectionObserver !== "function") {
  globalThis.IntersectionObserver = class {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly scrollMargin = "0px";
    readonly thresholds = [0];
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
    takeRecords() {
      return [];
    }
  };
}

if (typeof window.matchMedia !== "function") {
  window.matchMedia = (media) =>
    Object.assign(new EventTarget(), { media, matches: false, onchange: null }) as MediaQueryList;
}

// Pointer capture belongs to the browser; jsdom dispatches our test pointer events directly.
if (typeof HTMLElement.prototype.setPointerCapture !== "function") {
  HTMLElement.prototype.setPointerCapture = () => undefined;
  HTMLElement.prototype.releasePointerCapture = () => undefined;
  HTMLElement.prototype.hasPointerCapture = () => false;
}

installComboboxSelectOptions();
