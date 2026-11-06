import { ApiError } from "@wolbachia/api-client";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, expect, test } from "vitest";
import { setupI18n } from "../i18n/setup-i18n";
import { begin, commitKnown, commitSignedOut } from "../session/session-controller";
import { endSessionExpiry, reportSessionError } from "../session/session-events";
import { makeMe } from "../test/fake-api";
import { renderApp } from "../test/render-app";
import { Dialog } from "../ui/Dialog";
import { createAppQueryClient } from "../api/query-client";
import { isShellSessionAvailable } from "./shell-session";
beforeEach(endSessionExpiry);
afterEach(endSessionExpiry);

async function openOtherModal(kind: "native" | "radix" | "aria-modal") {
  if (kind === "radix") {
    const i18n = await setupI18n("es-MX");
    const view = render(
      <I18nextProvider i18n={i18n}>
        <Dialog
          open
          trigger={<button>Other task</button>}
          title="Blocking task"
          description="Task in progress"
        >
          <button>Continue task</button>
        </Dialog>
      </I18nextProvider>,
    );
    return { node: screen.getByRole("dialog", { name: "Blocking task" }), close: view.unmount };
  }
  const node = document.createElement(kind === "native" ? "dialog" : "section");
  node.setAttribute("aria-label", "Blocking task");
  if (kind === "aria-modal") {
    node.setAttribute("role", "alertdialog");
    node.setAttribute("aria-modal", "true");
  }
  const button = document.createElement("button");
  button.textContent = "Continue task";
  node.append(button);
  document.body.append(node);
  if (node instanceof HTMLDialogElement) node.showModal();
  button.focus();
  return {
    node,
    close: () => {
      node.remove();
    },
  };
}
function expectTaskExclusion(node: HTMLElement) {
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.queryByRole("dialog", { name: "Atajos de teclado" })).toBeNull();
  expect(node.closest('[aria-hidden="true"]')).toBeNull();
}
test.each(["native", "radix", "aria-modal"] as const)(
  "shell invocations cannot cover an open %s modal",
  async (kind) => {
    await renderApp();
    const search = screen.getByRole("searchbox", { name: "Buscar" });
    const other = await openOtherModal(kind);
    try {
      for (const shortcut of [
        { key: "k", ctrlKey: true },
        { key: "k", metaKey: true },
        { key: "?" },
      ]) {
        fireEvent.keyDown(document.body, shortcut);
        expectTaskExclusion(other.node);
      }
      fireEvent.click(search);
      expectTaskExclusion(other.node);
      fireEvent.keyDown(search, { key: "a" });
      expectTaskExclusion(other.node);
      other.close();
      await waitFor(() => {
        expect(other.node.isConnected).toBe(false);
      });
      fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
      expect(screen.getByRole("combobox")).toBeDefined();
    } finally {
      other.close();
    }
  },
);
test.each(["palette", "help"] as const)(
  "expiry removes %s before re-authentication and preserves password focus",
  async (kind) => {
    const app = await renderApp();
    const opener = kind === "palette" ? screen.getByRole("searchbox") : screen.getByRole("switch");
    opener.focus();
    fireEvent.keyDown(opener, kind === "palette" ? { key: "k", ctrlKey: true } : { key: "?" });
    const overlay = screen.getByRole("dialog");
    act(() => {
      reportSessionError(new ApiError(401), app.queryClient);
    });
    const reauth = await screen.findByRole("dialog", { name: "Tu sesión terminó" });
    await waitFor(() => {
      expect(overlay.isConnected).toBe(false);
    });
    expect(reauth.closest('[aria-hidden="true"]')).toBeNull();
    const password = within(reauth).getByLabelText<HTMLInputElement>("Contraseña", { exact: true });
    expect(document.activeElement).toBe(password);
    await userEvent.keyboard("x");
    expect(document.activeElement).toBe(password);
    expect(password.value).toBe("x");
  },
);
test("blocking a session dismisses shell help without reopening it when verification finishes", async () => {
  const app = await renderApp();
  fireEvent.keyDown(document.body, { key: "?" });
  const help = screen.getByRole("dialog", { name: "Atajos de teclado" });
  let verification!: ReturnType<typeof begin>;
  act(() => {
    verification = begin(app.queryClient, "verify");
  });
  await waitFor(() => {
    expect(help.isConnected).toBe(false);
  });
  fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
  expect(screen.queryByRole("combobox")).toBeNull();
  act(() => {
    commitKnown(app.queryClient, verification, { me: makeMe(), attestation: undefined });
  });
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

test("a confirmed sign-out cannot reopen shell overlays while the old shell unmounts", () => {
  const client = createAppQueryClient({ retry: false });
  const token = begin(client, "leave");
  commitSignedOut(client, token);
  expect(isShellSessionAvailable()).toBe(false);
  client.clear();
});
