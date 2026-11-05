import { QueryClientProvider } from "@tanstack/react-query";
import { ApiClientProvider } from "../api/ApiClientProvider";
import { createWebApiClient } from "../api/create-web-api-client";
import { createAppQueryClient } from "../api/query-client";
import { apiError, createFakeApi, makeVoidReasonItems } from "../test/fake-api";
import type { FakeApiRoutes } from "../test/fake-api";
import type { VoidChoice } from "./use-void-form";
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
const submitStub = () =>
  vi.fn<(choice: VoidChoice) => Promise<VoidResult>>(() => Promise.resolve(OK));

/** What a screen reader reads after the name of the field: the text of its `aria-describedby`. */
function descriptionOf(element: HTMLElement): string {
  const ids = (element.getAttribute("aria-describedby") ?? "").split(" ");
  return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
}

const CATALOG_ROUTE = "GET /api/v1/catalogs/void-reason/items/";

async function openChoiceDialog(
  submit: (choice: VoidChoice) => Promise<VoidResult>,
  language?: "en",
  reply?: FakeApiRoutes[string],
) {
  const user = userEvent.setup();
  const api = createFakeApi({
    [CATALOG_ROUTE]:
      reply ??
      Response.json({ count: 3, next: null, previous: null, results: makeVoidReasonItems() }),
  });
  const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });
  await renderWithI18n(
    <QueryClientProvider client={createAppQueryClient({ retry: false })}>
      <ApiClientProvider client={client}>
        <VoidHarness submit={submit} />
      </ApiClientProvider>
    </QueryClientProvider>,
    language,
  );
  await user.click(
    screen.getByRole("button", { name: language === "en" ? "Void OV-010" : OPEN_BUTTON }),
  );
  const select = screen.getByRole<HTMLSelectElement>("combobox");
  if (!reply) await screen.findByRole("option", { name: /Otro|Other/ });
  return { user, select, api };
}

async function openDialog(submit: (choice: VoidChoice) => Promise<VoidResult>, language?: "en") {
  const opened = await openChoiceDialog(submit, language);
  await opened.user.selectOptions(opened.select, "other");
  const reasonField = screen.getByRole<HTMLTextAreaElement>("textbox", {
    name: /detalle|details/i,
  });
  return { ...opened, reasonField };
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
  test("opens on an empty select with active items in API order, Other last", async () => {
    const { select, user } = await openChoiceDialog(submitStub());
    expect(document.activeElement).toBe(select);
    expect(select.value).toBe("");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Selecciona un motivo",
      "Capturado dos veces",
      "Otro (especificar)",
    ]);
    expect(screen.queryByRole("textbox")).toBeNull();
    await user.selectOptions(select, "other");
    const reasonField = screen.getByRole<HTMLTextAreaElement>("textbox");

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
    expect(submit).toHaveBeenCalledExactlyOnceWith({ reasonCode: "other", reason: GOOD_REASON });
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

describe("VoidDialog: catalog choices", () => {
  test("requires a choice, then submits a regular reason without text", async () => {
    const submit = submitStub();
    const { user, select } = await openChoiceDialog(submit);
    await pressVoid(user);
    expect(select.getAttribute("aria-invalid")).toBe("true");
    expect(descriptionOf(select)).toMatch(/Elige un motivo/);
    expect(submit).not.toHaveBeenCalled();
    await user.selectOptions(select, "other");
    await user.type(screen.getByRole("textbox"), GOOD_REASON);
    await user.selectOptions(select, "duplicate");
    expect(screen.queryByRole("textbox")).toBeNull();
    await pressVoid(user);
    expect(submit).toHaveBeenCalledExactlyOnceWith({ reasonCode: "duplicate", reason: "" });
  });

  test.each([
    apiError(500, "server_error"),
    Response.json({ count: 0, next: null, previous: null, results: [] }),
  ])("blocks submit when the catalog failed or has no active items, and retries", async (reply) => {
    const submit = submitStub();
    const { user, select, api } = await openChoiceDialog(submit, undefined, reply);
    await screen.findByRole("alert");
    expect(select.disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Anular" }).disabled).toBe(true);
    api.setRoute(
      CATALOG_ROUTE,
      Response.json({ count: 3, next: null, previous: null, results: makeVoidReasonItems() }),
    );
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("option", { name: "Capturado dos veces" });
    expect(select.disabled).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });

  test("a pending catalog disables the first field and submit until the items arrive", async () => {
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { select } = await openChoiceDialog(submitStub(), undefined, () => pending);
    expect(select.disabled).toBe(true);
    expect(screen.getByRole("option").textContent).toBe("Cargando motivos\u2026");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Anular" }).disabled).toBe(true);
    release(
      Response.json({ count: 3, next: null, previous: null, results: makeVoidReasonItems() }),
    );
    await screen.findByRole("option", { name: "Otro (especificar)" });
    expect(select.disabled).toBe(false);
    expect(document.activeElement).toBe(select);
  });

  test("uses English labels and falls back to Spanish for a blank English label", async () => {
    const items = makeVoidReasonItems().map((item) =>
      item.code === "duplicate" ? { ...item, label_en: "" } : item,
    );
    await openChoiceDialog(
      submitStub(),
      "en",
      Response.json({ count: items.length, next: null, previous: null, results: items }),
    );
    await screen.findByRole("option", { name: "Other (specify)" });
    expect(screen.getByRole("option", { name: "Capturado dos veces" })).toBeTruthy();
  });

  test("a code_unknown answer resets the select and refreshes the available choices", async () => {
    const { user, select, api } = await openChoiceDialog(() =>
      Promise.resolve(failing({ kind: "codeUnknown" })),
    );
    await user.selectOptions(select, "duplicate");
    api.setRoute(
      CATALOG_ROUTE,
      Response.json({
        count: 1,
        next: null,
        previous: null,
        results: makeVoidReasonItems().filter((item) => item.is_other),
      }),
    );
    await pressVoid(user);
    expect((await screen.findByRole("alert")).textContent).toMatch(/ya no est\u00e1 disponible/);
    await waitFor(() => {
      expect(screen.queryByRole("option", { name: "Capturado dos veces" })).toBeNull();
    });
    expect(select.value).toBe("");
  });

  test("required_for_other is described on the textarea", async () => {
    const { user, reasonField } = await openDialog(() =>
      Promise.resolve(failing({ kind: "requiredForOther" })),
    );
    await user.type(reasonField, GOOD_REASON);
    await pressVoid(user);
    await waitFor(() => {
      expect(reasonField.getAttribute("aria-invalid")).toBe("true");
    });
    expect(descriptionOf(reasonField)).toMatch(/Escribe el motivo al elegir Otro/);
    expect(document.activeElement).toBe(reasonField);
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
    expect(document.activeElement).toBe(screen.getByRole("combobox"));
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
