import { useRef } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { afterEach, expect, test, vi } from "vitest";
import { setupI18n } from "../i18n/setup-i18n";
import { AnnotationToolPicker } from "./AnnotationToolPicker";
import { AnnotationViewTools } from "./AnnotationViewTools";
import { AnnotationEditActions } from "./AnnotationEditActions";
import { AnnotationStats } from "./AnnotationStats";
import { EggAnnotationCanvas } from "./EggAnnotationCanvas";
import { useAnnotationWorkspaceView } from "./use-annotation-workspace-view";
import { downloadAnnotationFile } from "./annotation-download";
import { useAnnotationCounter } from "./use-annotation-format";
import { AnnotationToolbarExtras } from "./AnnotationToolbarExtras";

vi.mock("./use-annotation-drawing", () => ({ useAnnotationDrawing: () => undefined }));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function ToolsHarness({ compact = false }: { compact?: boolean }) {
  const view = useAnnotationWorkspaceView();
  const marks = useRef([]);
  return (
    <>
      <AnnotationToolPicker {...view} isLocked={false} />
      {compact ? (
        <AnnotationToolbarExtras
          {...view}
          count={0}
          canUndo={false}
          canRedo={false}
          isLocked={false}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          onFinish={vi.fn()}
          onDownloadMarks={vi.fn()}
          onDownloadImage={vi.fn()}
        />
      ) : (
        <>
          <AnnotationViewTools {...view} />
          <AnnotationEditActions
            {...view}
            canUndo={false}
            canRedo={false}
            isLocked={false}
            onUndo={vi.fn()}
            onRedo={vi.fn()}
          />
        </>
      )}
      {view.showSettings && <input aria-label="setting" />}
      <EggAnnotationCanvas
        {...view}
        ref={view.canvas}
        image={{ src: "blob:tools", width: 1000, height: 1000 }}
        marks={marks.current}
        markerColor="var(--color-action)"
        onMarksChange={vi.fn()}
      />
    </>
  );
}

test("tool, zoom and grid actions return keyboard focus, while settings inputs keep it", async () => {
  const i18n = await setupI18n("es-MX");
  render(
    <I18nextProvider i18n={i18n}>
      <ToolsHarness />
    </I18nextProvider>,
  );
  const canvas = screen.getByLabelText("Foto de la papeleta y marcas de huevos", {
    selector: "canvas",
  });
  for (const name of ["Punto (D)", "Acercar", "Alejar", "Ajustar imagen (R)", "Cuadrícula (G)"]) {
    await userEvent.click(screen.getByRole("button", { name }));
    expect(document.activeElement).toBe(canvas);
    fireEvent.keyDown(canvas, { key: "b" });
    expect(screen.getByRole("button", { name: "Caja (B)" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  }
  await userEvent.click(screen.getByRole("button", { name: "Ajustes (S)" }));
  await userEvent.type(screen.getByLabelText("setting"), "d");
  expect(document.activeElement).toBe(screen.getByLabelText("setting"));
  expect(screen.getByRole("button", { name: "Caja (B)" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
});

test("compact menu close keeps canvas focus after zoom and grid commands", async () => {
  const i18n = await setupI18n("es-MX");
  render(
    <I18nextProvider i18n={i18n}>
      <ToolsHarness compact />
    </I18nextProvider>,
  );
  const canvas = screen.getByLabelText("Foto de la papeleta y marcas de huevos", {
    selector: "canvas",
  });
  for (const name of ["Acercar", "Cuadrícula desactivada (G)", "Tamaño real (1)"]) {
    const compact = screen.getAllByRole("button", { name: "Acciones" }).at(-1);
    if (!compact) throw new Error("Compact menu trigger is missing");
    await userEvent.click(compact);
    await userEvent.click(screen.getByRole("menuitem", { name }));
    await waitFor(() => {
      expect(document.activeElement).toBe(canvas);
    });
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    fireEvent.keyDown(canvas, { key: "d" });
    expect(screen.getByRole("button", { name: "Punto (D)" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  }
});

test.each(["es-MX", "en"] as const)(
  "announces the mark limit and formats the zoom once in %s",
  async (locale) => {
    const i18n = await setupI18n(locale);
    const marks = Array.from({ length: 5000 }, () => ({ kind: "point" as const, x: 0, y: 0 }));
    render(
      <I18nextProvider i18n={i18n}>
        <EggAnnotationCanvas
          image={{ src: "blob:limit", width: 1000, height: 1000 }}
          marks={marks}
          tool="point"
          defaultBox={{ width: 12, height: 24 }}
          markerColor="var(--color-action)"
          showGrid={false}
          onMarksChange={vi.fn()}
        />
        <AnnotationStats marks={[]} width={1000} height={1000} zoom={0.25} />
      </I18nextProvider>,
    );
    const limit = i18n.t("labAnnotation.editor.maxMarks");
    expect(
      screen.getByText(
        (_, node) =>
          node?.getAttribute("aria-live") === "polite" && node.textContent.includes(limit),
      ),
    ).toBeDefined();
    const label = screen.getByText("Zoom", { selector: "dt" });
    expect(label.nextElementSibling?.textContent).toBe(
      new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(0.25),
    );
  },
);

test.each(["es-MX", "en"] as const)(
  "uses i18n plural rules for the egg counter in %s",
  async (locale) => {
    const i18n = await setupI18n(locale);
    const { result, rerender } = renderHook(({ count }) => useAnnotationCounter(count), {
      initialProps: { count: 1 },
      wrapper: ({ children }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>,
    });
    expect(result.current).toBe(locale === "es-MX" ? "1 huevo" : "1 egg");
    rerender({ count: 2 });
    expect(result.current).toBe(locale === "es-MX" ? "2 huevos" : "2 eggs");
  },
);

test("keeps a download URL alive through dispatch and revokes it in the next task", () => {
  vi.useFakeTimers();
  URL.createObjectURL = vi.fn(() => "blob:download");
  const revoke = vi.fn();
  URL.revokeObjectURL = revoke;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
    expect(revoke).not.toHaveBeenCalled();
  });
  downloadAnnotationFile(new Blob(["marks"]), "marks.json");
  expect(revoke).not.toHaveBeenCalled();
  act(() => {
    vi.runOnlyPendingTimers();
  });
  expect(revoke).toHaveBeenCalledWith("blob:download");
});
