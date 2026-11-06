import { fireEvent, render, screen } from "@testing-library/react";
import { messages } from "@wolbachia/i18n";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { afterEach, expect, test, vi } from "vitest";
import { setupI18n } from "../../i18n/setup-i18n";
import GeographyMap from "./GeographyMap";
import { MapPanel } from "./MapPanel";

interface EngineProps {
  workerUrl?: string;
  attributionControl?: boolean;
  onClick: (event: { lngLat: { lng: number; lat: number } }) => void;
  onError: () => void;
  children: ReactNode;
}
const { captureOptions } = vi.hoisted(() => ({
  captureOptions: vi.fn<(props: EngineProps) => void>(),
}));
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/assets/map-worker-test.js",
}));
// Tests our public adapter contract, never pretends that jsdom renders WebGL.
vi.mock("react-map-gl/maplibre", () => ({
  default: (props: EngineProps) => {
    captureOptions(props);
    return (
      <div role="region" aria-label="MapLibre boundary">
        <button
          type="button"
          onClick={() => {
            props.onClick({ lngLat: { lng: -99, lat: 19 } });
          }}
        >
          Map click
        </button>
        <button type="button" onClick={props.onError}>
          Style failure
        </button>
        {props.children}
      </div>
    );
  },
  Source: () => null,
  Layer: () => null,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  captureOptions.mockReset();
});

async function renderMap(element: ReactNode) {
  vi.stubEnv("VITE_MAP_TILES_URL", "");
  vi.stubEnv("VITE_MAP_ATTRIBUTION", "");
  const i18n = await setupI18n("en");
  return render(<I18nextProvider i18n={i18n}>{element}</I18nextProvider>);
}

test("WebGL1 alone uses the coordinate fallback without starting the v6 renderer", async () => {
  vi.stubGlobal("WebGLRenderingContext", vi.fn());
  vi.stubGlobal("WebGL2RenderingContext", undefined);
  await renderMap(<GeographyMap quadrants={[]} />);
  expect(screen.getByRole("status").textContent).toBe(messages.en["geography.map.fallback"]);
  expect(captureOptions).not.toHaveBeenCalled();
});

test("the Vite worker, disabled native attribution and longitude/latitude click reach the adapter", async () => {
  vi.stubGlobal("WebGLRenderingContext", vi.fn());
  vi.stubGlobal("WebGL2RenderingContext", vi.fn());
  const onVertex = vi.fn();
  await renderMap(<GeographyMap quadrants={[]} onVertex={onVertex} />);
  expect(captureOptions.mock.lastCall?.[0]).toMatchObject({
    workerUrl: "/assets/map-worker-test.js",
    attributionControl: false,
  });
  fireEvent.click(screen.getByRole("button", { name: "Map click" }));
  expect(onVertex).toHaveBeenCalledWith([-99, 19]);
});

test("configured attribution remains text beside the linked copyright attribution", async () => {
  vi.stubGlobal("WebGL2RenderingContext", vi.fn());
  vi.stubGlobal("WebGLRenderingContext", vi.fn());
  const i18n = await setupI18n("en");
  const attribution = '<img src="untrusted" onerror="untrusted()">';
  vi.stubEnv("VITE_MAP_TILES_URL", "https://tiles.example.org/style.json");
  vi.stubEnv("VITE_MAP_ATTRIBUTION", attribution);
  const { container } = render(
    <I18nextProvider i18n={i18n}>
      <GeographyMap quadrants={[]} />
    </I18nextProvider>,
  );
  expect(screen.getByText(attribution)).toBeDefined();
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByRole("link").getAttribute("href")).toBe(
    "https://www.openstreetmap.org/copyright",
  );
});

test("style failure preserves the coordinate drawing controls and their current draft", async () => {
  vi.stubGlobal("WebGL2RenderingContext", vi.fn());
  vi.stubGlobal("WebGLRenderingContext", vi.fn());
  const onText = vi.fn();
  await renderMap(<MapPanel quadrants={[]} text={"0,0\n2,0\n0,2"} onText={onText} />);
  fireEvent.click(screen.getByRole("button", { name: messages.en["geography.map.open"] }));
  fireEvent.click(await screen.findByRole("button", { name: "Style failure" }));
  expect(screen.getByRole("status").textContent).toBe(messages.en["geography.map.fallback"]);
  fireEvent.click(screen.getByRole("button", { name: messages.en["geography.map.closeRing"] }));
  expect(onText).toHaveBeenCalledWith("0,0\n2,0\n0,2\n0,0");
});
