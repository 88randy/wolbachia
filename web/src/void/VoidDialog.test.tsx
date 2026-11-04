import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, test, vi } from "vitest";
import { renderWithI18n } from "../test/render-with-i18n";
import { VoidHarness } from "../../harness/VoidHarness";
import type { VoidResult } from "./submit-void";
import type { VoidFailure } from "./void-failure";

const GOOD_REASON = "Capturado dos veces";
const OK: VoidResult = { ok: true };
const OPEN_BUTTON = "Anular OV-010";

const failing = (failure: VoidFailure): VoidResult => ({ ok: false, failure });
const submitStub = () => vi.fn<(reason: string) => Promise<VoidResult>>(() => Promise.resolve(OK));

/** What a screen reader reads after the name of the field: the text of its `aria-describedby`. */
function descriptionOf(element: HTMLElement): string {
  const ids = (element.getAttribute("aria-describedby") ?? "").split(" ");
  return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
}

async function openDialog(submit: (reason: string) => Promise<VoidResult>, language?: "en") {
  const user = userEvent.setup();
  await renderWithI18n(<VoidHarness submit={submit} />, language);
  await user.click(
    screen.getByRole("button", { name: language === "en" ? "Void OV-010" : OPEN_BUTTON }),
  );
  const reasonField = await screen.findByRole<HTMLTextAreaElement>("textbox", {
    name: /motivo|reason/i,
  });
  return { user, reasonField };
}

async function pressVoid(user: ReturnType<typeof userEvent.setup>, name = "Anular") {
  await user.click(screen.getByRole("button", { name }));
}

async function waitForClose() {
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
}

describe("VoidDialog", () => {
  test("opens on the reason field, named and described, with the minimum shown", async () => {
    const { reasonField } = await openDialog(submitStub());

    expect(screen.getByRole("dialog", { name: "Anular OV-010" })).toBeTruthy();
    expect(document.activeElement).toBe(reasonField);
    expect(reasonField.required).toBe(true);
    expect(descriptionOf(reasonField)).toMatch(
      /al menos 10 caracteres.*0 de 10 caracteres mínimos/,
    );
  });

  test("counts the trimmed characters live and shows the maximum once the minimum is met", async () => {
    const { user, reasonField } = await openDialog(submitStub());

    await user.type(reasonField, "  123456789   ");
    expect(screen.getByText("9 de 10 caracteres mínimos")).toBeTruthy();

    await user.clear(reasonField);
    await user.type(reasonField, "  1234567890  ");
    expect(screen.getByText("10 de 1000 caracteres como máximo")).toBeTruthy();
  });

  test("a short reason is refused here: error, focus on the field, nothing sent", async () => {
    const submit = submitStub();
    const { user, reasonField } = await openDialog(submit);
    await user.type(reasonField, "corto");

    await pressVoid(user);

    expect(submit).not.toHaveBeenCalled();
    expect(reasonField.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(reasonField);
    expect(descriptionOf(reasonField)).toMatch(/necesita al menos 10 caracteres/);
  });

  test("control or bidi text is refused here and nothing is sent", async () => {
    const submit = submitStub();
    const { user, reasonField } = await openDialog(submit);

    await user.type(reasonField, "\u202eabcdefghijkl");
    await pressVoid(user);

    expect((await screen.findByRole("alert")).textContent).toMatch(/caracteres que no se pueden/);
    expect(submit).not.toHaveBeenCalled();
  });

  test("an empty form says the same, and the error goes once the minimum is reached", async () => {
    const { user, reasonField } = await openDialog(submitStub());
    await pressVoid(user);
    expect(reasonField.getAttribute("aria-invalid")).toBe("true");

    await user.type(reasonField, "ya es suficiente");

    expect(reasonField.getAttribute("aria-invalid")).toBeNull();
  });

  test("sends the trimmed reason and closes when the server voids the record", async () => {
    const submit = submitStub();
    const { user, reasonField } = await openDialog(submit);

    await user.type(reasonField, `  ${GOOD_REASON}  `);
    await pressVoid(user);

    await waitForClose();
    expect(submit).toHaveBeenCalledExactlyOnceWith(GOOD_REASON);
    expect(screen.getAllByText("Anulado")).toHaveLength(2); // the row just voided and the old one
  });

  test("focus returns to the button that opened it", async () => {
    const { user, reasonField } = await openDialog(submitStub());
    await user.type(reasonField, GOOD_REASON);

    await pressVoid(user);

    await waitForClose();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: OPEN_BUTTON }));
  });

  test("Escape and Cancel give up without sending anything", async () => {
    const submit = submitStub();
    const { user } = await openDialog(submit);

    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    await waitForClose();
    await user.click(screen.getByRole("button", { name: OPEN_BUTTON }));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });
});

function pending() {
  let finish: (result: VoidResult) => void = () => undefined;
  const submit = vi.fn(
    () =>
      new Promise<VoidResult>((resolve) => {
        finish = resolve;
      }),
  );
  return {
    submit,
    finish: (result: VoidResult) => {
      finish(result);
    },
  };
}

describe("VoidDialog: while the request runs", () => {
  test("a second press, Escape and Cancel change nothing, and the answer still reaches the screen", async () => {
    const { submit, finish } = pending();
    const { user, reasonField } = await openDialog(submit);
    await user.type(reasonField, GOOD_REASON);
    await pressVoid(user);

    const busy = await screen.findByRole("button", { name: "Anulando…" });
    await user.click(busy);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(busy.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Cancelar" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeTruthy();
    finish(OK);
    await waitForClose();
    expect(screen.getAllByText("Anulado")).toHaveLength(2); // onVoided reached the screen
  });

  test("a browser that closes the dialog by itself (second Escape) sees it reopened on the reason", async () => {
    const { submit, finish } = pending();
    const { user, reasonField } = await openDialog(submit);
    await user.type(reasonField, GOOD_REASON);
    await pressVoid(user);
    await screen.findByRole("button", { name: "Anulando…" });
    const dialog = screen.getByRole("dialog");

    dialog.removeAttribute("open");
    fireEvent(dialog, new Event("close"));

    expect(dialog.hasAttribute("open")).toBe(true);
    expect(document.activeElement).toBe(reasonField);
    finish(OK);
  });

  test("the same close while idle means the user gave up", async () => {
    await openDialog(submitStub());
    const dialog = screen.getByRole("dialog");

    dialog.removeAttribute("open");
    fireEvent(dialog, new Event("close"));

    await waitForClose();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: OPEN_BUTTON }));
  });
});

describe("VoidDialog: what the server answers", () => {
  test("void_reason_too_short shows the server's minimum, even if it differs from ours", async () => {
    const submit = vi.fn(() => Promise.resolve(failing({ kind: "reasonTooShort", minLength: 15 })));
    const { user, reasonField } = await openDialog(submit);
    await user.type(reasonField, "doce de doce.");

    await pressVoid(user);

    await waitFor(() => {
      expect(reasonField.getAttribute("aria-invalid")).toBe("true");
    });
    expect(descriptionOf(reasonField)).toMatch(/necesita al menos 15 caracteres/);
    expect(screen.getByText("11 de 15 caracteres mínimos")).toBeTruthy();
    expect(document.activeElement).toBe(reasonField);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  test("any other failure goes to an alert that takes focus, and the text stays for another try", async () => {
    const { user, reasonField } = await openDialog(() =>
      Promise.resolve(failing({ kind: "alreadyVoided" })),
    );
    await user.type(reasonField, GOOD_REASON);

    await pressVoid(user);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Alguien ya anuló/);
    expect(document.activeElement).toBe(alert);
    expect(reasonField.value).toBe(GOOD_REASON);
  });
});

describe("VoidDialog: accessibility and language", () => {
  test("has no axe violations, open and with an error", async () => {
    const { user, reasonField } = await openDialog(submitStub());
    expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();

    await user.type(reasonField, "corto");
    await pressVoid(user);

    expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
  });

  test("speaks English when the language is English", async () => {
    const { user, reasonField } = await openDialog(submitStub(), "en");
    await user.type(reasonField, "short");

    await pressVoid(user, "Void");

    expect(screen.getByRole("dialog", { name: "Void OV-010" })).toBeTruthy();
    expect(descriptionOf(reasonField)).toMatch(/needs at least 10 characters/);
  });
});
