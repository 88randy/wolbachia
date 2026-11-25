import type { ComponentProps } from "react";
import { File as NativeFile } from "node:buffer";
import { act, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { afterEach, expect, test, vi } from "vitest";
import { setupI18n } from "../i18n/setup-i18n";
import { AnnotationUpload } from "./AnnotationUpload";

type Props = ComponentProps<typeof AnnotationUpload>;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mountUpload(overrides: Partial<Props> = {}) {
  vi.stubGlobal("File", NativeFile);
  const i18n = await setupI18n("es-MX");
  const onChoose = vi.fn<(file: File, clientId: string) => void>();
  const props: Props = {
    upload: { isBusy: false, upload: vi.fn(() => Promise.resolve()) },
    canUpload: true,
    onChoose,
    ...overrides,
  };
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  const view = render(<AnnotationUpload {...props} />, {
    wrapper: ({ children }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>,
  });
  return { ...view, props, onChoose };
}

test("starts a selected gallery photo immediately and keeps its identity for retry", async () => {
  const { props, onChoose, rerender } = await mountUpload();
  const photo = new File(["photo"], "paddle.png", { type: "image/png" });
  const input = screen.getByLabelText("Foto de la papeleta");
  fireEvent.change(input, { target: { files: [photo] } });
  await waitFor(() => {
    expect(onChoose).toHaveBeenCalledOnce();
  });
  const identity = onChoose.mock.calls[0]?.[1];
  expect(identity).toEqual(expect.any(String));
  expect(
    await screen.findByRole("img", { name: "Vista previa de la foto seleccionada" }),
  ).toBeDefined();
  expect(screen.queryByRole("button", { name: "Subir foto" })).toBeNull();
  rerender(
    <AnnotationUpload
      {...props}
      upload={{ ...props.upload, failure: { code: "invalid_image", params: {} } }}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(props.upload.upload).toHaveBeenLastCalledWith(photo, identity);
  expect(onChoose).toHaveBeenCalledOnce();
});

test("accepts a dropped photo automatically and clears the drag highlight", async () => {
  const { container, onChoose } = await mountUpload();
  const dropzone = container.querySelector("section");
  if (!dropzone) throw new Error("Photo dropzone is missing");
  const photo = new File(["photo"], "paddle.webp", { type: "image/webp" });
  fireEvent.dragOver(dropzone);
  expect(dropzone.getAttribute("data-drag-over")).toBe("true");
  fireEvent.drop(dropzone, { dataTransfer: { files: [photo] } });
  await waitFor(() => {
    expect(onChoose).toHaveBeenCalledWith(photo, expect.any(String));
  });
  expect(dropzone.hasAttribute("data-drag-over")).toBe(false);
});

test("rejects an unsupported photo before it replaces the draft", async () => {
  const { onChoose } = await mountUpload();
  fireEvent.change(screen.getByLabelText("Foto de la papeleta"), {
    target: { files: [new File(["other"], "image.svg", { type: "image/svg+xml" })] },
  });
  expect((await screen.findByRole("alert")).textContent).toContain("JPG, PNG o WebP");
  expect(onChoose).not.toHaveBeenCalled();
});

test.each([false, true])(
  "reads file items before files, with a fallback present: %s",
  async (hasFallback) => {
    const { onChoose } = await mountUpload();
    const photo = new File(["photo"], "paddle.png", { type: "image/png" });
    fireEvent.drop(document.body, {
      dataTransfer: {
        items: [{ kind: "file", getAsFile: () => photo }],
        files: hasFallback ? [new File(["other"], "other.webp", { type: "image/webp" })] : [],
      },
    });
    await waitFor(() => {
      expect(onChoose).toHaveBeenCalledWith(photo, expect.any(String));
    });
  },
);

test("handles a body drop and prevents browser navigation outside the card", async () => {
  const { onChoose } = await mountUpload();
  const photo = new File(["photo"], "paddle.png", { type: "image/png" });
  const drop = createEvent.drop(document.body, {
    dataTransfer: { files: [photo] },
  });
  fireEvent(document.body, drop);
  expect(drop.defaultPrevented).toBe(true);
  await waitFor(() => {
    expect(onChoose).toHaveBeenCalledWith(photo, expect.any(String));
  });
});

test("explains a URL-only drop without starting an upload", async () => {
  const { onChoose } = await mountUpload();
  fireEvent.drop(document.body, {
    dataTransfer: { items: [{ kind: "string", type: "text/uri-list" }], files: [] },
  });
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Arrastra un archivo de imagen desde tu computadora; las imágenes arrastradas desde una página no se pueden usar. También puedes usar Elegir archivo.",
  );
  expect(onChoose).not.toHaveBeenCalled();
});

test.each([
  { name: "paddle.jfif", type: "", expected: "image/jpeg", bytes: [255, 216, 255, 224] },
  {
    name: "paddle.jpe",
    type: "application/octet-stream",
    expected: "image/jpeg",
    bytes: [255, 216, 255, 224],
  },
  { name: "paddle.jfif", type: "image/jfif", expected: "image/jpeg", bytes: [255, 216, 255, 224] },
  { name: "paddle.png", type: "", expected: "image/png", bytes: [137, 80, 78, 71, 13, 10, 26, 10] },
  {
    name: "paddle.webp",
    type: "application/octet-stream",
    expected: "image/webp",
    bytes: [82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80],
  },
])(
  "detects $expected bytes in $name with MIME '$type' before uploading",
  async ({ name, type, expected, bytes }) => {
    const { onChoose } = await mountUpload();
    const photo = new File([new Uint8Array(bytes)], name, { type });
    fireEvent.drop(document.body, { dataTransfer: { files: [photo] } });
    await waitFor(() => {
      expect(onChoose).toHaveBeenCalledOnce();
    });
    const chosen = onChoose.mock.calls[0]?.[0];
    expect(chosen?.type).toBe(expected);
    expect(chosen?.name).toBe(name);
    expect(await chosen?.arrayBuffer()).toEqual(await photo.arrayBuffer());
  },
);

test("rejects non-image bytes even with a jpg filename", async () => {
  const { onChoose } = await mountUpload();
  fireEvent.drop(document.body, {
    dataTransfer: { files: [new File(["not an image"], "paddle.jpg")] },
  });
  expect((await screen.findByRole("alert")).textContent).toContain("JPG, PNG o WebP");
  expect(onChoose).not.toHaveBeenCalled();
});

test("reports an oversized image separately from unsupported formats", async () => {
  const { onChoose } = await mountUpload();
  const photo = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "paddle.png", {
    type: "image/png",
  });
  fireEvent.drop(document.body, { dataTransfer: { files: [photo] } });
  expect((await screen.findByRole("alert")).textContent).toContain("supera el límite de 10 MB");
  expect(onChoose).not.toHaveBeenCalled();
});

test("uses the first image among multiple files and announces the choice", async () => {
  const { onChoose } = await mountUpload();
  const photo = new File(["photo"], "paddle.png", { type: "image/png" });
  fireEvent.drop(document.body, {
    dataTransfer: {
      files: [
        new File(["text"], "notes.txt", { type: "text/plain" }),
        photo,
        new File(["other"], "other.webp", { type: "image/webp" }),
      ],
    },
  });
  await waitFor(() => {
    expect(onChoose).toHaveBeenCalledWith(photo, expect.any(String));
  });
  expect(screen.getByText(/Se usará la primera imagen/).getAttribute("role")).toBe("status");
});

test("keeps the full-page highlight across child transitions and clears on exit and drop", async () => {
  await mountUpload();
  const child = screen.getByRole("button", { name: "Elegir archivo" });
  const enter = createEvent.dragEnter(document.body);
  fireEvent(document.body, enter);
  expect(enter.defaultPrevented).toBe(true);
  expect(screen.getByText("Suelta la foto aquí")).toBeDefined();
  fireEvent.dragEnter(child);
  fireEvent.dragLeave(child);
  expect(screen.getByText("Suelta la foto aquí")).toBeDefined();
  fireEvent.dragLeave(document.body);
  expect(screen.queryByText("Suelta la foto aquí")).toBeNull();
  const over = createEvent.dragOver(document.body);
  fireEvent(document.body, over);
  expect(over.defaultPrevented).toBe(true);
  expect(screen.getByText("Suelta la foto aquí")).toBeDefined();
  fireEvent.drop(document.body, { dataTransfer: { files: [] } });
  expect(screen.queryByText("Suelta la foto aquí")).toBeNull();
  await screen.findByRole("alert");
});

test("removes global drop interception when the upload step unmounts", async () => {
  const { unmount, onChoose } = await mountUpload();
  unmount();
  const drop = createEvent.drop(document.body, {
    dataTransfer: { files: [new File(["photo"], "paddle.png", { type: "image/png" })] },
  });
  fireEvent(document.body, drop);
  expect(drop.defaultPrevented).toBe(false);
  expect(onChoose).not.toHaveBeenCalled();
});

test("does not upload when a pending header read finishes after unmount", async () => {
  const { unmount, onChoose } = await mountUpload();
  let finishRead: (bytes: ArrayBuffer) => void = () => {
    throw new Error("Header read not started");
  };
  const header = new Promise<ArrayBuffer>((resolve) => {
    finishRead = resolve;
  });
  const photo = new File([new Uint8Array([255, 216, 255, 224])], "paddle.jpe");
  vi.spyOn(photo, "slice").mockReturnValue(
    Object.assign(new Blob(), { arrayBuffer: () => header }),
  );
  fireEvent.drop(document.body, { dataTransfer: { files: [photo] } });
  unmount();
  await act(async () => {
    finishRead(new Uint8Array([255, 216, 255, 224]).buffer);
    await header;
  });
  expect(onChoose).not.toHaveBeenCalled();
});

test.each(["busy", "permission"])("refuses drops while blocked by %s", async (reason) => {
  const upload = { isBusy: reason === "busy", upload: vi.fn(() => Promise.resolve()) };
  const { container, onChoose } = await mountUpload({ upload, canUpload: reason !== "permission" });
  const dropzone = container.querySelector("section");
  if (!dropzone) throw new Error("Photo dropzone is missing");
  fireEvent.drop(dropzone, {
    dataTransfer: { files: [new File(["photo"], "paddle.png", { type: "image/png" })] },
  });
  expect(onChoose).not.toHaveBeenCalled();
});

test.each([false, true])(
  "keeps gallery separate from camera capture on coarse pointer: %s",
  async (isCoarse) => {
    vi.stubGlobal(
      "matchMedia",
      (media: string) =>
        Object.assign(new EventTarget(), { media, matches: isCoarse }) as MediaQueryList,
    );
    await mountUpload();
    const gallery = screen.getByLabelText("Foto de la papeleta");
    expect(gallery.hasAttribute("capture")).toBe(false);
    expect(gallery.hasAttribute("hidden")).toBe(true);
    expect(screen.getByRole("button", { name: "Elegir archivo" })).toBeDefined();
    const camera = screen.queryByRole("button", { name: "Tomar foto" });
    expect(camera !== null).toBe(isCoarse);
    if (isCoarse)
      expect(screen.getByLabelText("Tomar foto").getAttribute("capture")).toBe("environment");
  },
);
