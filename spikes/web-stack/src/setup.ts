import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";

// jest-axe works under Vitest with this shim (vitest-axe is stale: 0.1.0, Jan 2025).
expect.extend(toHaveNoViolations);
// Vitest has no globals by default, so RTL's auto-cleanup does not run.
afterEach(cleanup);

declare module "vitest" {
  interface Assertion {
    toHaveNoViolations(): void;
  }
}
