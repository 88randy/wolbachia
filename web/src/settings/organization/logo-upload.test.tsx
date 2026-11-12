import { endSessionExpiry } from "../../session/session-events";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import {
  apiError,
  createFakeApi,
  FAKE_IDENTITY,
  makeMe,
  makeOrganization,
} from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
afterEach(() => {
  endSessionExpiry();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const ORGANIZATION = { ...makeOrganization("norte", "Programa de prueba"), revision: 4 };

test("logo upload sends raster multipart with revision and CSRF while retaining unsaved label draft", async () => {
  const me = makeMe({
    permissions: ["organization.read", "organization.update"],
    scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
  });
  let uploaded: FormData | null = null;
  let csrf: string | null = null;
  const api = createFakeApi({
    "GET /api/v1/me/": () => Response.json(me),
    "GET /api/v1/organization/": () => Response.json(ORGANIZATION),
  });
  document.cookie = "csrftoken=w03-csrf; path=/";
  try {
    const app = await renderApp({
      path: "/settings/organization",
      fetch: async (request) => {
        if (request.method !== "POST") return api.fetch(request);
        uploaded = await request.formData();
        csrf = request.headers.get("X-CSRFToken");
        return Response.json(
          { ...ORGANIZATION, revision: 5 },
          { headers: { "X-Session-Identity": FAKE_IDENTITY } },
        );
      },
    });
    const phone = await screen.findByRole<HTMLInputElement>("textbox", {
      name: "Teléfono en etiquetas de ovitrampa",
    });
    await userEvent.type(phone, "1234");
    const png = new File(
      [
        Uint8Array.from(
          atob(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC",
          ),
          (character) => character.charCodeAt(0),
        ),
      ],
      "logo.png",
      { type: "image/png" },
    );
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 1, height: 1, close: vi.fn() }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(png);
    });
    fireEvent.change(screen.getByLabelText("Logotipo"), { target: { files: [png] } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar logotipo" }));
    await screen.findByText("Logotipo guardado");
    expect(screen.queryByText("Cambios guardados")).toBeNull();
    const cached = app.queryClient.getQueriesData({
      predicate: (query) => query.queryKey[4] === "organization",
    });
    expect(cached.map(([, value]) => value)).toEqual([{ ...ORGANIZATION, revision: 5 }]);
    expect(uploaded).not.toBeNull();
    expect((uploaded as unknown as FormData).get("expected_revision")).toBe("4");
    const raster = (uploaded as unknown as FormData).get("logo");
    expect(typeof raster === "object" && raster?.type).toBe("image/png");
    expect(csrf).toBe("w03-csrf");
    expect(phone.value).toBe("1234");
    // The revision is no longer printed on the page; the cached organization above carries it.
    expect(screen.getByLabelText("Iniciales de la organización").textContent).toBe("PD");
  } finally {
    document.cookie = "csrftoken=; Max-Age=0; path=/";
  }
});

test("an expired session while reading the optional logo uses the session dialog", async () => {
  const me = makeMe({
    permissions: ["organization.read", "organization.update"],
    scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
  });
  const api = createFakeApi({
    "GET /api/v1/me/": () => Response.json(me),
    "GET /api/v1/organization/": () =>
      Response.json({ ...ORGANIZATION, logo_url: "/api/v1/organization/logo/" }),
    "GET /api/v1/organization/logo/": () => apiError(401, "not_authenticated"),
  });
  await renderApp({ path: "/settings/organization", fetch: api.fetch });
  expect(await screen.findByRole("dialog", { name: "Tu sesión terminó" })).toBeDefined();
});
