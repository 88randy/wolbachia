import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { expect, test, vi } from "vitest";
import { setupI18n } from "../../i18n/setup-i18n";
import { inventoryLocation } from "../../test/inventory-fixtures";
import { LocationPin } from "./LocationPin";
import { LocationPopupContent } from "./LocationPopupContent";
import { clusterLocations } from "./location-pins";
import { usePinSelection } from "./use-pin-selection";

async function renderInRouter(ui: () => React.ReactElement) {
  const i18n = await setupI18n("es-MX");
  const root = createRootRoute({ component: ui });
  const record = createRoute({
    getParentRoute: () => root,
    path: "/inventory/locations/$code",
    component: () => null,
  });
  const router = createRouter({
    routeTree: root.addChildren([record]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return render(
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nextProvider>,
  );
}

function first<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error("empty");
  return item;
}
const single = () => first(clusterLocations([inventoryLocation()], 12));
const pair = () =>
  first(
    clusterLocations(
      [
        inventoryLocation(),
        inventoryLocation({ id: "other", code: "LOC-02", name: "Second store" }),
      ],
      12,
    ),
  );

test("a single pin shows icon, a hover tooltip text, and opens on click with its key", async () => {
  const onOpen = vi.fn();
  await renderInRouter(() => <LocationPin cluster={single()} expanded={false} onOpen={onOpen} />);
  const pin = await screen.findByRole("button", { name: /LOC-01/ });
  expect(pin.getAttribute("aria-haspopup")).toBe("dialog");
  expect(pin.getAttribute("data-shape")).toBe("square");
  expect(screen.getByText("LOC-01 · Synthetic store")).toBeTruthy();
  await userEvent.click(pin);
  expect(onOpen).toHaveBeenCalledWith(single().key, pin);
});

test("a cluster pin shows the count and is announced as a list", async () => {
  await renderInRouter(() => <LocationPin cluster={pair()} expanded={false} onOpen={vi.fn()} />);
  const pin = await screen.findByRole("button", { name: /2 ubicaciones/ });
  expect(pin.textContent).toBe("2");
});

test("the popup lists the details and a link to the record", async () => {
  await renderInRouter(() => (
    <LocationPopupContent cluster={single()} centerName={() => "Mérida"} onClose={vi.fn()} />
  ));
  expect(await screen.findByText("Synthetic owner")).toBeTruthy();
  expect(screen.getByText("Mérida")).toBeTruthy();
  expect(screen.getByText("Almacén")).toBeTruthy();
  expect(screen.getByText("-99, 19")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Ver la ubicación" }).getAttribute("href")).toContain(
    "/inventory/locations/LOC-01",
  );
});

test("a cluster popup lists every location, each linking to its record", async () => {
  await renderInRouter(() => (
    <LocationPopupContent cluster={pair()} centerName={() => null} onClose={vi.fn()} />
  ));
  const links = await screen.findAllByRole("link");
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    expect.stringContaining("LOC-01"),
    expect.stringContaining("LOC-02"),
  ]);
});

test("only one popup is open at a time, and Esc closes it and returns focus to the pin", () => {
  const first = document.createElement("button");
  const second = document.createElement("button");
  document.body.append(first, second);
  const { result } = renderHook(() => usePinSelection());
  act(() => {
    result.current.open("one", first);
  });
  act(() => {
    result.current.open("two", second);
  });
  expect(result.current.selectedKey).toBe("two");
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });
  expect(result.current.selectedKey).toBeNull();
  expect(document.activeElement).toBe(second);
  first.remove();
  second.remove();
});
