import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";
import { afterEach, expect } from "vitest";

// jest-axe works under Vitest with this shim (vitest-axe is stale, see ADR 0001).
expect.extend(toHaveNoViolations);

// Vitest has no globals by default, so Testing Library's automatic cleanup does not run.
afterEach(cleanup);

declare module "vitest" {
  interface Assertion {
    toHaveNoViolations(): void;
  }
}
