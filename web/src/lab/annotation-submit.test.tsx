import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { apiError, makeVoidReasonItems } from "../test/fake-api";
import { BAG, COUNT, candidate, count, openCount, outcome, pageOf } from "./count-test-helpers";
import type { AnnotationCanvasProps } from "./annotation-canvas-types";
import { uploadAnnotationPhoto } from "./annotation-upload";
import { writeAnnotationDraft } from "./annotation-draft";

vi.mock("./annotation-draft", () => ({
  readAnnotationDraft: () => Promise.resolve(undefined),
  writeAnnotationDraft: vi.fn(() => Promise.resolve()),
  writeAnnotationDraftMarks: () => Promise.resolve(),
  annotationDraftGeneration: () => 0,
  purgeAnnotationDrafts: () => Promise.resolve(),
}));
vi.mock("./annotation-upload", async (original) => ({
  ...(await original<typeof import("./annotation-upload")>()),
  uploadAnnotationPhoto: vi.fn((options: Parameters<typeof uploadAnnotationPhoto>[0]) =>
    Promise.resolve({
      file: options.file,
      clientId: options.clientId,
      uploadId: "00000000-0000-4000-8000-000000000033",
      width: 4096,
      height: 2048,
    }),
  ),
}));
vi.mock("./EggAnnotationCanvas", () => ({
  EggAnnotationCanvas: (props: AnnotationCanvasProps) => (
    <button
      type="button"
      onClick={() => {
        props.onMarksChange?.([
          ...props.marks,
          props.marks.length % 2 === 0
            ? { kind: "box", x: 10, y: 20, w: 12, h: 24 }
            : { kind: "point", x: 50, y: 60 },
        ]);
      }}
    >
      Add egg
    </button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => "blob:annotation-test");
  URL.revokeObjectURL = vi.fn();
});

function openAnnotation(options: Parameters<typeof openCount>[0] = {}) {
  return openCount({
    ...options,
    permissions: options.permissions ?? [
      "egg_count.create",
      "egg_count.read",
      "egg_count.void",
      "catalog.read",
      "field.upload",
    ],
  });
}

async function prepareAnnotation() {
  const photo = new File([new Uint8Array([137, 80, 78, 71])], "egg-paddle.png", {
    type: "image/png",
  });
  await userEvent.upload(await screen.findByLabelText("Foto de la papeleta"), photo);
  await userEvent.click(await screen.findByRole("button", { name: "Omitir" }));
  return screen.findByRole("button", { name: "Add egg" });
}

test("submits mixed marks as the official value and confirms only after the server asks", async () => {
  const { api } = await openAnnotation({
    path: "/lab/egg-counts/B-031/annotate",
    routes: {
      [`POST /api/v1/bags/${BAG}/counts/`]: ({ body }) =>
        (body as { confirmed_implausible: boolean }).confirmed_implausible
          ? outcome({ ...candidate("B-032"), id: "bag-32" })
          : apiError(409, "lab_confirmation_required"),
      "GET /api/v1/egg-counts/queue/": ({ path }) =>
        pageOf([candidate(path.includes("B-032") ? "B-032" : "B-031")]),
    },
  });
  const add = await prepareAnnotation();
  await userEvent.click(add);
  await userEvent.click(add);
  await userEvent.click(screen.getByRole("button", { name: "Terminar" }));
  await userEvent.click(await screen.findByRole("button", { name: "Guardar conteo y siguiente" }));
  await userEvent.click(await screen.findByRole("button", { name: "Confirmar conteo alto" }));
  await screen.findByRole("heading", { name: "B-032" });
  const posts = api.requests.filter((request) => request.method === "POST");
  expect(posts).toHaveLength(2);
  expect(posts[0]?.body).toMatchObject({
    value: 2,
    expected_revision: 0,
    confirmed_implausible: false,
    annotation: {
      tool_version: "aedesvision-web-1",
      marks: [
        { kind: "box", x: 10, y: 20, w: 12, h: 24 },
        { kind: "point", x: 50, y: 60 },
      ],
    },
  });
  expect(posts[1]?.body).toMatchObject({ value: 2, confirmed_implausible: true });
  expect(posts[0]?.body).not.toEqual(posts[1]?.body);
  expect(
    Object.keys(sessionStorage).filter(
      (key) => key.startsWith("aedesvision:annotation:") && key.endsWith("command"),
    ),
  ).toEqual([]);
});

test("explicit retry replays the complete annotation command after an ambiguous response", async () => {
  let attempts = 0;
  const { api } = await openAnnotation({
    path: "/lab/egg-counts/B-031/annotate",
    routes: {
      [`POST /api/v1/bags/${BAG}/counts/`]: () => {
        if (++attempts === 1) throw new TypeError("Lost annotation reply");
        return outcome();
      },
    },
  });
  await userEvent.click(await prepareAnnotation());
  await userEvent.click(screen.getByRole("button", { name: "Terminar" }));
  await userEvent.click(await screen.findByRole("button", { name: "Guardar conteo y siguiente" }));
  await userEvent.click(await screen.findByRole("button", { name: "Reintentar guardado" }));
  await waitFor(() => {
    expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(2);
  });
  const posts = api.requests.filter((request) => request.method === "POST");
  expect(posts[0]?.body).toEqual(posts[1]?.body);
});

test("replacement annotation uses the atomic void command with the retained canonical reason draft", async () => {
  const { api } = await openAnnotation({
    path: "/lab/egg-counts/B-031/annotate?correction=true",
    routes: {
      "GET /api/v1/egg-counts/": pageOf([count({ bag_code: "B-031" })]),
      "GET /api/v1/catalogs/void-reason/items/": pageOf(makeVoidReasonItems()),
      [`GET /api/v1/egg-counts/${COUNT}/void-context/`]: Response.json({
        id: COUNT,
        kind: "count",
        bag_id: BAG,
        current_revision: 1,
        is_current: true,
        blocked_by: [],
      }),
      [`POST /api/v1/egg-counts/${COUNT}/void/`]: Response.json({
        void_id: "void-annotation",
        current_revision: 2,
        count: count({ value: 1 }),
        next_bag: null,
        queue_snapshot: { as_of: "2026-11-03T15:00:00Z", context: {} },
      }),
    },
  });
  await screen.findByRole("option", { name: "Capturado dos veces" });
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Motivo de anulación" }),
    "duplicate",
  );
  await userEvent.type(
    screen.getByRole("textbox", { name: "Explicación" }),
    "Correct photo observation",
  );
  await userEvent.click(await prepareAnnotation());
  await userEvent.click(screen.getByRole("button", { name: "Terminar" }));
  await userEvent.click(await screen.findByRole("button", { name: "Guardar conteo y siguiente" }));
  await waitFor(() => {
    expect(api.requests.find((request) => request.method === "POST")?.body).toMatchObject({
      expected_revision: 1,
      reason_code: "duplicate",
      reason: "Correct photo observation",
      replacement: {
        kind: "count",
        value: 1,
        annotation: { marks: [{ kind: "box", x: 10, y: 20, w: 12, h: 24 }] },
      },
    });
  });
  expect(
    api.requests
      .filter((request) => request.method === "POST")
      .every((request) => request.path.includes("/void/")),
  ).toBe(true);
  expect(
    Object.keys(sessionStorage).filter(
      (key) => key.startsWith("aedesvision:annotation:") && key.endsWith("command"),
    ),
  ).toEqual([]);
});

test("disables photo upload and explains missing upload permission without authorizing a file", async () => {
  const { api } = await openAnnotation({
    path: "/lab/egg-counts/B-031/annotate",
    permissions: ["egg_count.create"],
  });
  const picker = await screen.findByLabelText<HTMLInputElement>("Foto de la papeleta");
  expect(picker.disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Elegir archivo" }).getAttribute("aria-disabled")).toBe(
    "true",
  );
  expect(screen.getByText(/Necesitas permiso para subir fotos/)).toBeDefined();
  expect(uploadAnnotationPhoto).not.toHaveBeenCalled();
  expect(api.requests.some((request) => request.method === "POST")).toBe(false);
});

test.each(["toolbar", "menu", "breadcrumb", "sidebar"])(
  "unsaved photo blocks %s navigation; keep stays and leave resumes the requested destination",
  async (exit) => {
    const { app } = await openAnnotation();
    await screen.findByRole("heading", { name: "B-031" });
    await act(() =>
      app.router.navigate({
        to: "/lab/egg-counts/$bagCode/annotate",
        params: { bagCode: "B-031" },
      }),
    );
    await prepareAnnotation();
    const requestExit = async () => {
      if (exit === "menu") {
        const menu = screen.getAllByRole("button", { name: "Acciones" }).at(-1);
        if (!menu) throw new Error("Missing annotation Actions menu");
        await userEvent.click(menu);
        await userEvent.click(await screen.findByRole("menuitem", { name: "Volver al conteo" }));
      } else {
        const link =
          exit === "toolbar"
            ? screen.getByRole("link", { name: "Volver al conteo" })
            : exit === "sidebar"
              ? within(screen.getByRole("navigation", { name: "Navegación principal" })).getByRole(
                  "link",
                  { name: "Inicio" },
                )
              : within(screen.getByRole("navigation", { name: "Ruta de navegación" })).getByRole(
                  "link",
                  { name: "Conteo de huevos" },
                );
        await userEvent.click(link);
      }
    };
    await requestExit();
    const dialog = await screen.findByRole("dialog", { name: "¿Salir sin guardar el conteo?" });
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: "Seguir marcando" }),
    );
    expect(dialog.textContent).toMatch(/borrador local.*navegador/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Seguir marcando" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(app.router.state.location.pathname).toBe("/lab/egg-counts/B-031/annotate");
    await requestExit();
    await userEvent.click(
      within(
        await screen.findByRole("dialog", { name: "¿Salir sin guardar el conteo?" }),
      ).getByRole("button", { name: "Salir" }),
    );
    await waitFor(() => {
      expect(app.router.state.location.pathname).toBe(exit === "sidebar" ? "/" : "/lab/egg-counts");
    });
  },
);

test("empty annotation navigation stays unblocked and beforeunload is installed only until a successful save", async () => {
  const addListener = vi.spyOn(window, "addEventListener");
  const removeListener = vi.spyOn(window, "removeEventListener");
  const { app } = await openAnnotation({
    path: "/lab/egg-counts/B-031/annotate",
    routes: { [`POST /api/v1/bags/${BAG}/counts/`]: () => outcome() },
  });
  await screen.findByLabelText("Foto de la papeleta");
  expect(addListener.mock.calls.filter(([type]) => type === "beforeunload")).toHaveLength(0);
  await act(() => app.router.navigate({ to: "/lab/egg-counts" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  await act(() =>
    app.router.navigate({ to: "/lab/egg-counts/$bagCode/annotate", params: { bagCode: "B-031" } }),
  );
  await prepareAnnotation();
  const listener = addListener.mock.calls.find(([type]) => type === "beforeunload")?.[1];
  expect(listener).toBeDefined();
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Terminar" }));
  await userEvent.click(await screen.findByRole("button", { name: "Guardar conteo y siguiente" }));
  await waitFor(() => {
    expect(app.router.state.location.pathname).toBe("/lab/egg-counts");
  });
  expect(screen.queryByRole("dialog", { name: "¿Salir sin guardar el conteo?" })).toBeNull();
  expect(
    removeListener.mock.calls.some(
      ([type, callback]) => type === "beforeunload" && callback === listener,
    ),
  ).toBe(true);
  const savedUnload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(savedUnload);
  expect(savedUnload.defaultPrevented).toBe(false);
  addListener.mockRestore();
  removeListener.mockRestore();
});

test("draft storage failure warns that leaving can lose the photo and marks", async () => {
  vi.mocked(writeAnnotationDraft).mockRejectedValueOnce(new Error("Draft storage unavailable"));
  const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  await openAnnotation({ path: "/lab/egg-counts/B-031/annotate" });
  await prepareAnnotation();
  await userEvent.click(screen.getByRole("link", { name: "Volver al conteo" }));
  const dialog = await screen.findByRole("dialog", { name: "¿Salir sin guardar el conteo?" });
  expect(dialog.textContent).toContain("Si sales, podrías perder la foto y las marcas");
  expect(dialog.textContent).not.toContain("puedes recuperarlas");
  warning.mockRestore();
});
