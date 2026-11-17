import { configure } from "@testing-library/react";
import { vi } from "vitest";

/**
 * Import for its side effect from test files that render the whole app (router, session, lazy
 * screens) and drive it through several steps.
 *
 * One such test takes 2-6 s in jsdom, and more while the other test files run in parallel. A
 * timeout is not harmless: the timed-out body keeps running against the shared DOM and makes the
 * next tests of the file fail with unrelated errors. So the test budget is 30 s and `findBy*` waits
 * up to 5 s for the first render of a screen. Both only matter when the machine is slow: a test
 * that finds what it waits for returns at once.
 */
vi.setConfig({ testTimeout: 30_000 });
configure({ asyncUtilTimeout: 5_000 });
