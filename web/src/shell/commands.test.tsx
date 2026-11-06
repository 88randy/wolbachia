import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { makeMe } from "../test/fake-api";
import { renderApp } from "../test/render-app";
test("palette exposes only permitted navigation areas", async () => {
  await renderApp({ me: makeMe({ permissions: [] }) });
  await userEvent.keyboard("{Control>}k{/Control}");
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("option", { name: "Inicio" })).toBeDefined();
  expect(within(dialog).queryByRole("option", { name: "Configuración" })).toBeNull();
  expect(within(dialog).queryByRole("option", { name: "Flota" })).toBeNull();
});
test("question mark opens help outside fields and leaves typing alone", async () => {
  await renderApp();
  const field = document.createElement("input");
  screen.getByRole("main").append(field);
  fireEvent.keyDown(field, { key: "?" });
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.keyDown(document.body, { key: "?" });
  expect(screen.getByRole("dialog", { name: "Atajos de teclado" })).toBeDefined();
});

test("typing in shell search transfers the first character into the palette", async () => {
  await renderApp();
  screen.getByRole("searchbox", { name: "Buscar" }).focus();
  await userEvent.keyboard("l");
  const input = within(screen.getByRole("dialog")).getByRole<HTMLInputElement>("combobox");
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe("l");
});

test("palette navigation leaves focus on destination main; Escape returns it to the invoker", async () => {
  await renderApp();
  const search = screen.getByRole("searchbox", { name: "Buscar" });
  search.focus();
  await userEvent.keyboard("{Control>}k{/Control}");
  await userEvent.keyboard("{Escape}");
  expect(document.activeElement).toBe(search);
  await userEvent.keyboard("{Control>}k{/Control}");
  await userEvent.type(within(screen.getByRole("dialog")).getByRole("combobox"), "Laboratorio");
  await userEvent.keyboard("{Enter}");
  await screen.findByRole("heading", { level: 1, name: "Laboratorio" });
  expect(document.activeElement).toBe(screen.getByRole("main"));
});

test("selecting the current area still moves focus out of the closed palette", async () => {
  await renderApp();
  await userEvent.keyboard("{Control>}k{/Control}");
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("option", { name: "Inicio" }));
  await waitFor(() => {
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });
  expect(screen.queryByRole("dialog")).toBeNull();
});
