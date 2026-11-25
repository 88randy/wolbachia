import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { expect, test, vi } from "vitest";
import { setupI18n } from "../i18n/setup-i18n";
import { AnnotationSettings, type AnnotationColor } from "./AnnotationSettings";
import { AnnotationShortcutsDialog } from "./AnnotationShortcutsDialog";
import type { AnnotationTool } from "./annotation-canvas-types";
import { AnnotationStats } from "./AnnotationStats";
import type { AnnotationMark } from "./annotation-state";
import { AnnotationBoxSettings } from "./AnnotationBoxSettings";

function SettingsHarness() {
  const [defaultBox, setDefaultBox] = useState({ width: 12, height: 24 });
  const [color, setColor] = useState<AnnotationColor>("action");
  const [showGrid, setGrid] = useState(false);
  const [gridSize, setGridSize] = useState(310);
  const [tool, onToolChange] = useState<AnnotationTool>("box");
  return (
    <AnnotationSettings
      {...{
        defaultBox,
        setDefaultBox,
        color,
        setColor,
        showGrid,
        gridSize,
        setGridSize,
        tool,
        onToolChange,
      }}
      userId="settings-test"
      onGrid={() => {
        setGrid(!showGrid);
      }}
      marks={[]}
      width={2949}
      height={3316}
      zoom={0.29}
    />
  );
}

test("settings exposes radio swatches, bounded pixel sliders and conditional grid size", async () => {
  const i18n = await setupI18n("es-MX");
  const user = userEvent.setup();
  render(
    <I18nextProvider i18n={i18n}>
      <SettingsHarness />
    </I18nextProvider>,
  );
  const panel = screen.getByRole("dialog", { name: "Panel" });
  const swatches = within(panel).getByRole("radiogroup", { name: "Color de marcador" });
  expect(within(swatches).getAllByRole("radio")).toHaveLength(5);
  await user.click(within(swatches).getByRole("radio", { name: "Azul" }));
  await user.click(within(swatches).getByRole("radio", { name: "Verde" }));
  expect(within(swatches).getByRole<HTMLInputElement>("radio", { name: "Verde" }).checked).toBe(
    true,
  );
  expect(document.activeElement).toBe(within(swatches).getByRole("radio", { name: "Verde" }));
  const width = within(panel).getByRole("slider", { name: "Ancho de caja" });
  fireEvent.keyDown(width, { key: "ArrowRight" });
  expect(width.getAttribute("value")).toBe("13");
  fireEvent.keyDown(width, { key: "ArrowUp", shiftKey: true });
  expect(width.getAttribute("value")).toBe("23");
  fireEvent.keyDown(width, { key: "End" });
  fireEvent.keyDown(width, { key: "ArrowRight", shiftKey: true });
  expect(width.getAttribute("value")).toBe("200");
  expect(within(panel).queryByRole("slider", { name: "Tamaño de cuadrícula" })).toBeNull();
  await user.click(within(panel).getByRole("switch", { name: "Cuadrícula" }));
  const grid = within(panel).getByRole("slider", { name: "Tamaño de cuadrícula" });
  fireEvent.keyDown(grid, { key: "ArrowRight" });
  expect(grid.getAttribute("value")).toBe("320");
  await user.click(within(panel).getByRole("button", { name: "Cambiar a puntos" }));
  expect(within(panel).getByRole("button", { name: "Cambiar a cajas" })).toBeDefined();
});

test("panel reuses the shortcut dialog rows and returns nested guide focus to its footer", async () => {
  const i18n = await setupI18n("en");
  const user = userEvent.setup();
  localStorage.setItem("aedesvision:annotation-tips:settings-test", "seen");
  const rendered = render(
    <I18nextProvider i18n={i18n}>
      <SettingsHarness />
    </I18nextProvider>,
  );
  const actions = screen.getByRole("table").textContent;
  const guide = screen.getByRole("button", { name: "View annotation guide" });
  await user.click(guide);
  expect(screen.getByRole("dialog", { name: i18n.t("labAnnotation.tips.title") })).toBeDefined();
  await user.keyboard("{Escape}");
  expect(document.activeElement).toBe(guide);
  rendered.unmount();
  render(
    <I18nextProvider i18n={i18n}>
      <AnnotationShortcutsDialog open onOpenChange={vi.fn()} />
    </I18nextProvider>,
  );
  expect(screen.getByRole("table").textContent).toBe(actions);
  localStorage.removeItem("aedesvision:annotation-tips:settings-test");
});

test.each(["es-MX", "en"] as const)(
  "formats the summary and derives mixed mode in %s",
  async (locale) => {
    const i18n = await setupI18n(locale);
    const summary = (marks: AnnotationMark[]) => (
      <I18nextProvider i18n={i18n}>
        <AnnotationStats marks={marks} width={2949} height={3316} zoom={0.29} />
      </I18nextProvider>
    );
    const point: AnnotationMark = { kind: "point", x: 10, y: 10 };
    const rendered = render(summary([point]));
    expect(screen.getByText(i18n.t("labAnnotation.editor.markedOne"))).toBeDefined();
    expect(screen.getByText("2949×3316")).toBeDefined();
    expect(
      screen.getByText(i18n.t("labAnnotation.editor.points"), { selector: "dd" }),
    ).toBeDefined();
    rendered.rerender(summary([point, point, point, { kind: "box", x: 10, y: 10, w: 12, h: 24 }]));
    expect(screen.getByText(i18n.t("labAnnotation.editor.markedOther"))).toBeDefined();
    expect(screen.getByText(i18n.t("labAnnotation.editor.mixed"))).toBeDefined();
    expect(
      screen.getByText(
        `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(0.41)} /Mpx`,
      ),
    ).toBeDefined();
  },
);

test("limits a restored box preference to the current photo in its value and announcement", async () => {
  const i18n = await setupI18n("en");
  const setDefaultBox = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <AnnotationBoxSettings
        defaultBox={{ width: 98, height: 42 }}
        width={50}
        height={30}
        setDefaultBox={setDefaultBox}
      />
    </I18nextProvider>,
  );
  const width = screen.getByRole<HTMLInputElement>("slider", { name: "Box width" });
  expect(width.value).toBe("50");
  expect(width.getAttribute("aria-valuetext")).toBe("50px");
  fireEvent.keyDown(width, { key: "ArrowLeft", shiftKey: true });
  expect(setDefaultBox).toHaveBeenCalledWith({ width: 40, height: 42 });
});
