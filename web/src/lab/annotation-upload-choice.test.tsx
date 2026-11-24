import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
  expect(onChoose).toHaveBeenCalledOnce();
  const identity = onChoose.mock.calls[0]?.[1];
  expect(identity).toEqual(expect.any(String));
  expect(screen.getByRole("img", { name: "Vista previa de la foto seleccionada" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Subir foto" })).toBeNull();
  rerender(
    <AnnotationUpload
      {...props}
      upload={{ ...props.upload, failure: { code: "invalid_image", params: {} } }}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(onChoose).toHaveBeenLastCalledWith(photo, identity);
});

test("accepts a dropped photo automatically and clears the drag highlight", async () => {
  const { container, onChoose } = await mountUpload();
  const dropzone = container.querySelector("section");
  if (!dropzone) throw new Error("Photo dropzone is missing");
  const photo = new File(["photo"], "paddle.webp", { type: "image/webp" });
  fireEvent.dragOver(dropzone);
  expect(dropzone.getAttribute("data-drag-over")).toBe("true");
  fireEvent.drop(dropzone, { dataTransfer: { files: [photo] } });
  expect(onChoose).toHaveBeenCalledWith(photo, expect.any(String));
  expect(dropzone.hasAttribute("data-drag-over")).toBe(false);
});

test("rejects an unsupported photo before it replaces the draft", async () => {
  const { onChoose } = await mountUpload();
  fireEvent.change(screen.getByLabelText("Foto de la papeleta"), {
    target: { files: [new File(["other"], "image.svg", { type: "image/svg+xml" })] },
  });
  expect(screen.getByRole("alert").textContent).toContain("JPG, PNG o WebP");
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
