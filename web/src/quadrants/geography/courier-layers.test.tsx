import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { expect, test, vi } from "vitest";
import { setupI18n } from "../../i18n/setup-i18n";
import { CourierLayers } from "./CourierLayers";

// jsdom has no WebGL: markers render their content so the dots themselves can be checked.
vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children }: { children: ReactNode }) => <div data-testid="track">{children}</div>,
  Layer: () => null,
  Marker: ({ children }: { children: ReactNode }) => <div data-testid="marker">{children}</div>,
}));

test("one dot per courier with icon and name; a stale one is hollow and carries its age", async () => {
  const i18n = await setupI18n("es-MX");
  render(
    <I18nextProvider i18n={i18n}>
      <CourierLayers
        couriers={[
          { id: "s1", label: "Luis", at: [-99.1, 19.4], isStale: false },
          { id: "s2", label: "Rosa · hace 15 min", at: [-99.2, 19.5], isStale: true },
        ]}
      />
    </I18nextProvider>,
  );
  const markers = screen.getAllByTestId("marker");
  expect(markers).toHaveLength(2);
  const [fresh, stale] = markers.map((marker) => marker.firstElementChild);
  expect(fresh?.textContent).toBe("Luis");
  expect(fresh?.getAttribute("data-stale")).toBe("false");
  expect(fresh?.querySelector("svg")).not.toBeNull();
  expect(stale?.textContent).toBe("Rosa · hace 15 min");
  expect(stale?.getAttribute("data-stale")).toBe("true");
  expect(stale?.querySelector(".border-dashed")).not.toBeNull();
  expect(screen.queryByTestId("track")).toBeNull();
});

test("a track draws its line with start and end markers", async () => {
  const i18n = await setupI18n("es-MX");
  render(
    <I18nextProvider i18n={i18n}>
      <CourierLayers
        track={[
          [
            [-99.1, 19.4],
            [-99.11, 19.41],
          ],
          [[-99.2, 19.5]],
        ]}
      />
    </I18nextProvider>,
  );
  expect(screen.getByTestId("track")).toBeDefined();
  expect(screen.getAllByTestId("marker").map((marker) => marker.textContent)).toEqual([
    "Inicio",
    "Fin",
  ]);
});
