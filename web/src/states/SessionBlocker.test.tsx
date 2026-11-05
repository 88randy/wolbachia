import { fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { renderWithI18n } from "../test/render-with-i18n";
import { SessionBlocker } from "./SessionBlocker";

test("Escape (the dialog's cancel event) does not close the blocker", async () => {
  await renderWithI18n(<SessionBlocker state="reconciling" />);
  const dialog = screen.getByText("Verificando tu sesión…").closest("dialog");
  const cancel = new Event("cancel", { cancelable: true });

  fireEvent(dialog as HTMLDialogElement, cancel);

  expect(cancel.defaultPrevented).toBe(true);
  expect(dialog?.hasAttribute("open")).toBe(true);
});
