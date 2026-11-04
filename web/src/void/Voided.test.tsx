import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, test } from "vitest";
import { renderWithI18n } from "../test/render-with-i18n";
import { VoidedBadge } from "./VoidedBadge";
import { VoidedCell } from "./VoidedCell";
import type { VoidInfo } from "./void-info";

const INFO: VoidInfo = { reason: "Folio duplicado", author: "Marco Reyes", when: "12 sep 2026" };

function renderCell(info: VoidInfo | null) {
  return renderWithI18n(
    <table>
      <caption>Ovitrampas</caption>
      <tbody>
        <tr>
          <td>
            <VoidedCell info={info}>OV-019</VoidedCell>
          </td>
          <td>
            <button type="button">Otro control</button>
          </td>
        </tr>
      </tbody>
    </table>,
  );
}

const details = () => screen.getByText(/Motivo: Folio duplicado/).parentElement as HTMLElement;

describe("VoidedCell", () => {
  test("shows a record that is not voided as it is", async () => {
    await renderCell(null);

    expect(screen.getByText("OV-019").tagName).toBe("TD");
    expect(screen.queryByRole("button", { name: /Anulado/ })).toBeNull();
  });

  test("strikes a voided record through and adds the Voided badge (word and icon, not color)", async () => {
    const { container } = await renderCell(INFO);

    expect(screen.getByText("OV-019").tagName).toBe("S");
    expect(screen.getByRole("button", { name: "Anulado" })).toBeTruthy();
    expect(container.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  test("a screen reader reads reason, author and date as the badge's description", async () => {
    await renderCell(INFO);

    const badge = screen.getByRole("button", { name: "Anulado" });

    const description = (badge.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ");
    expect(description).toBe("Motivo: Folio duplicadoAnuló: Marco ReyesFecha: 12 sep 2026");
  });

  test("has no axe violations", async () => {
    const { container } = await renderCell(INFO);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("VoidedBadge: hover and keyboard focus", () => {
  test("the details are hidden until the pointer is over the badge, and they stay while on them", async () => {
    const user = userEvent.setup();
    await renderCell(INFO);
    expect(details().hidden).toBe(true);

    await user.hover(screen.getByRole("button", { name: "Anulado" }));
    expect(details().hidden).toBe(false);
    await user.hover(details());
    expect(details().hidden).toBe(false);

    await user.unhover(details());
    expect(details().hidden).toBe(true);
  });

  test("keyboard focus shows them, Escape dismisses them without moving focus, leaving resets", async () => {
    const user = userEvent.setup();
    await renderCell(INFO);
    const badge = screen.getByRole("button", { name: "Anulado" });

    await user.tab();
    expect(document.activeElement).toBe(badge);
    expect(details().hidden).toBe(false);

    await user.keyboard("{Escape}");
    expect(details().hidden).toBe(true);
    expect(document.activeElement).toBe(badge);

    await user.tab();
    expect(details().hidden).toBe(true);
    await user.tab({ shift: true });
    expect(details().hidden).toBe(false);
  });

  test("Escape on a badge that is not showing anything is left for the page (a side panel closes on it)", async () => {
    const user = userEvent.setup();
    let reached = false;
    await renderWithI18n(
      // A stand-in for a side panel that closes on Escape: it only listens, it is not a control.
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <div
        onKeyDown={() => {
          reached = true;
        }}
      >
        <VoidedBadge info={INFO} />
      </div>,
    );

    await user.tab();
    await user.keyboard("{Escape}"); // dismisses the details: the panel must not close too
    expect(reached).toBe(false);
    await user.keyboard("{Escape}"); // nothing left to dismiss
    expect(reached).toBe(true);
  });

  test("leaves out the date when there is none", async () => {
    await renderWithI18n(<VoidedBadge info={{ reason: "Folio duplicado", author: "Marco" }} />);

    expect(screen.queryByText(/Fecha:/)).toBeNull();
  });
});
