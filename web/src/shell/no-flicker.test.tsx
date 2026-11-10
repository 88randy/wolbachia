import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { LOADING_DELAY_MS } from "../ui/use-delayed-flag";
import { createFakeApi, makeMe } from "../test/fake-api";
import { renderApp } from "../test/render-app";

const ME = "GET /api/v1/me/";
const DEVICES = "GET /api/v1/devices/";
const ALLOWED = makeMe({ permissions: ["device.read"] });
const FAST_MS = 50;

function phone(label: string) {
  return {
    id: label,
    label,
    serial: "SN-1",
    app_version: "1.0.0",
    last_seen_at: null,
    last_user: null,
    last_user_username: null,
    is_revoked: false,
    revoked_at: null,
    revoked_by: null,
    created_at: "2026-10-01T15:00:00Z",
  };
}

function later(response: () => Response, ms: number): () => Promise<Response> {
  return () =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(response());
      }, ms);
    });
}

/** Records every moment where the page is blocked or shows a loading status. */
function watchFlicker(): { seen: () => string[]; stop: () => void } {
  const found = new Set<string>();
  const look = (): void => {
    if (document.querySelector("main")?.hasAttribute("inert")) found.add("main inert");
    if (screen.queryByText("Verificando tu sesión…")) found.add("session blocker");
    if (document.querySelector('[role="status"][aria-label="Cargando"]')) found.add("skeleton");
  };
  const observer = new MutationObserver(look);
  observer.observe(document.body, { subtree: true, childList: true, attributes: true });
  return {
    seen: () => [...found],
    stop: () => {
      observer.disconnect();
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

test("a focus refetch of /me/ that answers fast never blocks or blanks the app (#368)", async () => {
  let call = 0;
  const api = createFakeApi({
    [ME]: later(() => Response.json(ALLOWED), FAST_MS),
    [DEVICES]: () => {
      call += 1;
      return Response.json({ count: 1, next: null, previous: null, results: [phone("Phone A")] });
    },
  });
  await renderApp({ path: "/settings/phones", fetch: api.fetch, me: ALLOWED });
  await screen.findByRole("row", { name: /Phone A/ });
  const watch = watchFlicker();

  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(FAST_MS * 2);
  });

  expect(watch.seen()).toEqual([]);
  expect(screen.getByRole("row", { name: /Phone A/ })).toBeDefined();
  expect(call).toBeGreaterThan(0);
  watch.stop();
});

test("a focus check that takes longer than the delay does block, with the blocker (#368)", async () => {
  const api = createFakeApi({
    [ME]: later(() => Response.json(ALLOWED), LOADING_DELAY_MS * 3),
    [DEVICES]: Response.json({ count: 1, next: null, previous: null, results: [phone("Phone A")] }),
  });
  await renderApp({ path: "/settings/phones", fetch: api.fetch, me: ALLOWED });
  await screen.findByRole("row", { name: /Phone A/ });

  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(LOADING_DELAY_MS + 1);
  });

  expect(screen.getByText("Verificando tu sesión…")).toBeDefined();
  expect(screen.getByRole("main", { hidden: true }).hasAttribute("inert")).toBe(true);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(LOADING_DELAY_MS * 3);
  });
  expect(screen.queryByText("Verificando tu sesión…")).toBeNull();
});

test("changing a filter keeps the rows and shows no skeleton while the answer takes under the delay (#368)", async () => {
  let call = 0;
  const api = createFakeApi({
    [ME]: Response.json(ALLOWED),
    [DEVICES]: later(() => {
      call += 1;
      return Response.json({
        count: 1,
        next: null,
        previous: null,
        results: [phone(`Phone ${String(call)}`)],
      });
    }, FAST_MS),
  });
  await renderApp({ path: "/settings/phones", fetch: api.fetch, me: ALLOWED });
  await screen.findByRole("row", { name: /Phone 1/ });
  const watch = watchFlicker();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  await user.selectOptions(screen.getByRole("combobox", { name: "Estado" }), "Revocado");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(FAST_MS * 2);
  });

  expect(screen.getByRole("row", { name: /Phone 2/ })).toBeDefined();
  expect(watch.seen()).toEqual([]);
  watch.stop();
});

test("a refetch that lasts longer than the delay shows the subtle indicator, not a skeleton (#368)", async () => {
  let call = 0;
  const api = createFakeApi({
    [ME]: Response.json(ALLOWED),
    [DEVICES]: later(() => {
      call += 1;
      return Response.json({
        count: 1,
        next: null,
        previous: null,
        results: [phone(`Phone ${String(call)}`)],
      });
    }, LOADING_DELAY_MS * 3),
  });
  await renderApp({ path: "/settings/phones", fetch: api.fetch, me: ALLOWED });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(LOADING_DELAY_MS * 4);
  });
  await screen.findByRole("row", { name: /Phone 1/ });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  await user.selectOptions(screen.getByRole("combobox", { name: "Estado" }), "Revocado");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(LOADING_DELAY_MS * 2);
  });

  expect(screen.getByText("Actualizando…")).toBeDefined();
  expect(screen.getByRole("row", { name: /Phone 1/ })).toBeDefined();
  expect(document.querySelector('[role="status"][aria-label="Cargando"]')).toBeNull();
});
