import { render, screen, within, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, test } from "vitest";
import { setupI18n } from "../i18n/setup-i18n";
import { KpiCell } from "./KpiCell";
import { RelativeTime } from "./RelativeTime";
import { TrendChart } from "./TrendChart";

describe("analytics accessibility", () => {
  test.each([
    [6.2, "+6.2%", "Up"],
    [-2.1, "-2.1%", "Down"],
    [0, "0%", "Unchanged"],
  ])("a delta of %s has a sign and a spoken comparison", async (delta, signed, direction) => {
    const instance = await setupI18n("en");
    render(
      <I18nextProvider i18n={instance}>
        <KpiCell label="Reviewed" value="1,284" delta={delta} />
      </I18nextProvider>,
    );
    expect(screen.getByText(signed)).toBeDefined();
    expect(screen.getByText(new RegExp(`${direction}.*previous period`))).toBeDefined();
  });
  test("relative time exposes the absolute organization time without a pointer", async () => {
    const instance = await setupI18n("en");
    render(
      <I18nextProvider i18n={instance}>
        <RelativeTime
          dateTime="2026-11-05T17:57:00Z"
          timeZone="America/Mexico_City"
          now={Date.parse("2026-11-05T18:00:00Z")}
        />
      </I18nextProvider>,
    );
    const time = screen.getByText("3 minutes ago");
    expect(time.getAttribute("datetime")).toBe("2026-11-05T17:57:00Z");
    expect(time.getAttribute("tabindex")).toBe("0");
    expect(screen.getByText(/Nov 5, 2026.*11:57/)).toBeDefined();
  });
  test("the trend table preserves every label and raw value behind the SVG", async () => {
    const instance = await setupI18n("en");
    render(
      <I18nextProvider i18n={instance}>
        <TrendChart
          title="Weekly review"
          labels={["Week 1", "Week 2"]}
          series={[
            { id: "reviewed", label: "Reviewed", values: [45, 78] },
            { id: "eggs", label: "With eggs", values: [14, 29], tone: 2 },
          ]}
          valueSuffix="%"
        />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const table = screen.getByRole("table", { name: "Weekly review" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("Week 2")).toBeDefined();
    expect(within(table).getByText("78%")).toBeDefined();
    expect(within(table).getByText("29%")).toBeDefined();
  });
  test("keyboard inspection exposes the selected period and exact values", async () => {
    const instance = await setupI18n("en");
    render(
      <I18nextProvider i18n={instance}>
        <TrendChart
          title="Weekly coverage"
          labels={["Week 1", "Week 2"]}
          series={[{ id: "coverage", label: "Coverage", values: [45, 78] }]}
          valueSuffix="%"
        />
      </I18nextProvider>,
    );
    const slider = screen.getByRole("slider");
    fireEvent.focus(slider);
    fireEvent.change(slider, { target: { value: "1" } });
    expect(slider.getAttribute("aria-valuetext")).toBe("Week 2: Coverage: 78%");
    expect(screen.getByText("78%", { selector: "dd" })).toBeDefined();
  });
  test("four series remain distinguishable without their colors", async () => {
    const instance = await setupI18n("en");
    const { container } = render(
      <I18nextProvider i18n={instance}>
        <TrendChart
          title="Four measures"
          labels={["Week 1"]}
          series={["A", "B", "C", "D"].map((id) => ({ id, label: id, values: [40] }))}
        />
      </I18nextProvider>,
    );
    const series = [...container.querySelectorAll("svg g[data-pattern]")];
    expect(
      new Set(series.map((item) => item.querySelector("path")?.getAttribute("stroke-dasharray")))
        .size,
    ).toBe(4);
    const markers = series.map((item) => item.lastElementChild);
    expect(
      new Set(
        markers.map(
          (marker) => `${marker?.tagName ?? ""}:${marker?.getAttribute("transform") ?? ""}`,
        ),
      ).size,
    ).toBe(4);
    expect(
      new Set(
        [...container.querySelectorAll("li > [data-pattern]")].map((item) =>
          item.getAttribute("data-pattern"),
        ),
      ).size,
    ).toBe(4);
  });
});
