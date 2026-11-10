import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { renderApp } from "../test/render-app";
import { renderWithI18n } from "../test/render-with-i18n";
import { ReceptionScanner } from "./ReceptionScanner";
import type { ReceptionActions } from "./use-reception-command";
import { apiError } from "../test/fake-api";
import { simulateLogin } from "../test/simulate-session";
import {
  receptionApi,
  receptionReply,
  page,
  receipt,
  bag,
  BAG_ID,
  READING_ID,
} from "../test/lab-reception-fixtures";
import { ID, incident } from "../test/incident-fixtures";

async function reviewCurrentState(user: ReturnType<typeof userEvent.setup>) {
  await vi.waitFor(() => {
    expect(
      screen.getByRole("button", { name: "Review current state" }).getAttribute("aria-disabled"),
    ).not.toBe("true");
  });
  await user.click(screen.getByRole("button", { name: "Review current state" }));
}
async function waitForReceptionReads() {
  await screen.findByText("There are no records here yet");
  await vi.waitFor(() => {
    expect(screen.getAllByRole("link", { name: "0" })).toHaveLength(2);
  });
}

test("20 keyboard scans normalize framing, retain focus and never show a field egg count", async () => {
  const submit = vi.fn<ReceptionActions["submit"]>().mockImplementation((_command, onStarted) => {
    onStarted?.();
    return Promise.resolve(true);
  });
  const actions: ReceptionActions = {
    submit,
    canSubmit: true,
    revision: 0,
    isBusy: false,
    result: null,
    isReviewRequired: false,
    setResult: vi.fn(),
    review: vi.fn(),
  };
  await renderWithI18n(<ReceptionScanner actions={actions} />, "en");
  const scan = await screen.findByRole("textbox", { name: "Bag code" });
  for (let index = 1; index <= 20; index++) {
    fireEvent.change(scan, { target: { value: `  B-${String(index)}\t` } });
    const form = scan.closest("form");
    if (!form) throw new Error("Scanner form missing");
    fireEvent.submit(form);
    expect(document.activeElement).toBe(scan);
  }
  await vi.waitFor(
    () => {
      expect(submit).toHaveBeenCalledTimes(20);
    },
    { interval: 1 },
  );
  const bodies = submit.mock.calls
    .map(([command]) => command)
    .filter((command) => command.kind === "bag");
  expect(bodies).toHaveLength(20);
  expect(bodies.map((body) => body.code)).toEqual(
    Array.from({ length: 20 }, (_, index) => `B-${String(index + 1)}`),
  );
  expect(new Set(bodies.map((body) => body.command_id)).size).toBe(20);
  expect(document.body.textContent).not.toMatch(/field eggs|field count/i);
});

test("an unadmitted scan keeps its code and command UUID until the live gate accepts it", async () => {
  let canStart = false;
  const admitted: string[] = [];
  const submit = vi.fn<ReceptionActions["submit"]>().mockImplementation((command, onStarted) => {
    if (canStart) {
      onStarted?.();
      if (command.kind === "bag") admitted.push(command.code);
    }
    return Promise.resolve(canStart);
  });
  const actions: ReceptionActions = {
    submit,
    canSubmit: true,
    revision: 0,
    isBusy: false,
    result: null,
    isReviewRequired: false,
    setResult: vi.fn(),
    review: vi.fn(),
  };
  await renderWithI18n(<ReceptionScanner actions={actions} />, "en");
  const scan = screen.getByRole("textbox", { name: "Bag code" });
  fireEvent.change(scan, { target: { value: "B-030" } });
  const form = scan.closest("form");
  if (!form) throw new Error("Scanner form missing");
  fireEvent.submit(form);
  expect(screen.getByText(/Scans waiting · 1/)).toBeDefined();
  expect(admitted).toEqual([]);
  canStart = true;
  fireEvent.change(scan, { target: { value: "next draft" } });
  await vi.waitFor(() => {
    expect(admitted).toEqual(["B-030"]);
  });
  expect(submit.mock.calls).toHaveLength(2);
  expect(submit.mock.calls[1]?.[0].command_id).toBe(submit.mock.calls[0]?.[0].command_id);
  expect((scan as HTMLInputElement).value).toBe("next draft");
});

test("duplicate scans, unknown codes and no-reading incidents stay keyboard usable", async () => {
  const api = receptionApi(["bag.receive", "incident.read"]);
  const answers = [
    apiError(409, "already_received"),
    apiError(404, "not_found"),
    Response.json(
      { code: "no_reading", detail: "Missing source", discrepancy_id: BAG_ID, incident_id: ID },
      { status: 409 },
    ),
  ];
  api.setRoute("POST /api/v1/bags/receive/", () => {
    const answer = answers.shift();
    if (!answer) throw new Error("Unexpected repeated reception");
    return answer;
  });
  api.setRoute(`GET /api/v1/incidents/${ID}/`, Response.json(incident()));
  await renderApp({ path: "/lab/bags", fetch: api.fetch, language: "en" });
  const user = userEvent.setup();
  const scan = await screen.findByRole("textbox", { name: "Bag code" });
  await user.type(scan, "B-030{Enter}");
  await screen.findByText(/No additional receipt was created/);
  await user.type(scan, "FOREIGN{Enter}");
  await screen.findByText(/No available bag was found/);
  await user.type(scan, "B-030{Enter}");
  await screen.findByText(/no effective field reading/);
  expect((await screen.findByRole("link", { name: /Open incident/ })).getAttribute("href")).toBe(
    "/incidents/I-0033",
  );
  expect(document.activeElement).toBe(scan);
});

test("Enter-delimited scans remain serialized and pause on uncertainty until explicit review", async () => {
  const api = receptionApi();
  const heldReads: ((reply: Response) => void)[] = [];
  api.setRoute(
    "GET /api/v1/lab-receptions/",
    () =>
      new Promise<Response>((finish) => {
        heldReads.push(finish);
      }),
  );
  let reject!: (error: Error) => void;
  api.setRoute(
    "POST /api/v1/bags/receive/",
    () =>
      new Promise<Response>((_resolve, fail) => {
        reject = fail;
      }),
  );
  await renderApp({ path: "/lab/bags", fetch: api.fetch, language: "en" });
  const user = userEvent.setup();
  const scan = await screen.findByRole("textbox", { name: "Bag code" });
  await user.type(scan, "B-030{Enter}");
  await user.type(scan, "B-031{Enter}");
  await user.type(scan, "B-032{Enter}draft");
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  await act(async () => {
    reject(new Error("Connection lost"));
    await Promise.resolve();
  });
  await screen.findByText(/could not confirm the result/);
  expect((scan as HTMLInputElement).value).toBe("draft");
  await user.type(scan, "{Enter}");
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  let finishDrain!: () => void;
  const drained = new Promise<void>((finish) => {
    finishDrain = finish;
  });
  api.setRoute("GET /api/v1/lab-receptions/", page([]));
  api.setRoute("POST /api/v1/bags/receive/", (request) => {
    const { code } = request.body as { code: string };
    if (code === "B-032") finishDrain();
    return receptionReply(code);
  });
  await reviewCurrentState(user);
  await drained;
  const codes = api.requests
    .filter((request) => request.method === "POST")
    .map((request) => (request.body as { code: string }).code);
  expect(codes).toEqual(["B-030", "B-031", "B-032"]);
  expect((scan as HTMLInputElement).value).toBe("draft");
  await act(async () => {
    heldReads.forEach((finish) => {
      finish(page([]));
    });
    await Promise.resolve();
  });
});

test("an old-session response cannot overwrite a queued scan resumed after explicit review", async () => {
  const api = receptionApi();
  let resolve!: (reply: Response) => void;
  api.setRoute(
    "POST /api/v1/bags/receive/",
    () =>
      new Promise<Response>((finish) => {
        resolve = finish;
      }),
  );
  const app = await renderApp({ path: "/lab/bags", fetch: api.fetch, language: "en" });
  await waitForReceptionReads();
  const user = userEvent.setup();
  const scan = await screen.findByRole("textbox", { name: "Bag code" });
  await user.type(scan, "B-030{Enter}");
  await user.type(scan, "B-031{Enter}");
  const readsBefore = api.requests.filter((request) => request.method === "GET").length;
  await act(async () => {
    simulateLogin();
    await Promise.resolve();
  });
  await screen.findByText(/could not confirm the result/);
  // The shared session controller restarts reads before an explicit recovery can review them.
  await vi.waitFor(() => {
    expect(api.requests.filter((request) => request.method === "GET").length).toBeGreaterThan(
      readsBefore,
    );
  });
  await vi.waitFor(() => {
    expect(app.queryClient.isFetching()).toBe(0);
  });
  api.setRoute("POST /api/v1/bags/receive/", receptionReply("B-031"));
  await reviewCurrentState(user);
  await vi.waitFor(() => {
    expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(2);
  });
  await screen.findByText(/You can scan the next one/);
  await act(async () => {
    resolve(receptionReply());
    await Promise.resolve();
  });
  expect(
    screen.getByText(/You can scan the next one/).closest('[role="status"]')?.textContent,
  ).toContain("B-031");
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(2);
});

test("expected missing observations use the real bag and retain configuration-pending truth", async () => {
  const api = receptionApi();
  api.setRoute("GET /api/v1/bags/", page([bag()], 30));
  api.setRoute(
    `POST /api/v1/bags/${BAG_ID}/mark-missing/`,
    Response.json(
      {
        code: "lab_configuration_unavailable",
        detail: "Policy absent",
        discrepancy_id: BAG_ID,
        incident_id: null,
      },
      { status: 409 },
    ),
  );
  await renderApp({
    path: "/lab/bags?view=expected&week=2026-W45",
    fetch: api.fetch,
    language: "en",
  });
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Mark missing" }));
  const dialog = screen.getByRole("dialog");
  await user.type(
    within(dialog).getByRole("textbox", { name: "Reason for missing bag" }),
    "Not in the physical delivery",
  );
  await user.click(within(dialog).getByRole("button", { name: "Record missing bag" }));
  await user.keyboard("{Escape}");
  await screen.findByText(/incident is awaiting configuration/);
  const posted = api.requests.find((request) => request.method === "POST");
  const body = posted?.body as { command_id: unknown; reason: string };
  expect(typeof body.command_id).toBe("string");
  expect(body.reason).toBe("Not in the physical delivery");
  expect(screen.queryByRole("link", { name: /Open incident/ })).toBeNull();
  expect(
    api.requests.some(
      (request) =>
        request.path.includes("lab_status=expected") && request.path.includes("week=2026-W45"),
    ),
  ).toBe(true);
});

test("received details show boolean field facts and no-paddle receipts never require a bag", async () => {
  const api = receptionApi();
  api.setRoute("GET /api/v1/lab-receptions/", page([receipt()]));
  api.setRoute(
    `POST /api/v1/readings/${READING_ID}/receive/`,
    Response.json({
      bag: null,
      reading: { id: READING_ID, paddle_present: false },
      receipt: receipt({ bag_id: null, kind: "no_paddle" }),
    }),
  );
  await renderApp({ path: "/lab/bags", fetch: api.fetch, language: "en" });
  const user = userEvent.setup();
  await screen.findByText("B-030");
  await user.click(screen.getByRole("button", { name: "Show details" }));
  expect(await screen.findByText("Egg paddle present?")).toBeDefined();
  expect(await screen.findByText("Has eggs?")).toBeDefined();
  expect(await screen.findByText("Yes", { exact: true })).toBeDefined();
  expect(await screen.findByText("No", { exact: true })).toBeDefined();
  await user.click(screen.getByText("Receive reading without egg paddle", { selector: "summary" }));
  await user.type(screen.getByRole("textbox", { name: "Reading identifier (UUID)" }), READING_ID);
  await user.click(screen.getByRole("button", { name: "Receive reading without egg paddle" }));
  await screen.findByText(/not added to the count queue/);
  const body = api.requests.find((request) => request.method === "POST")?.body as Record<
    string,
    unknown
  >;
  expect(Object.keys(body)).toEqual(["command_id"]);
  expect(typeof body["command_id"]).toBe("string");
});

test("partial read errors leave scanning available and retry only the failed list", async () => {
  const api = receptionApi(["bag.receive"]);
  api.setRoute("GET /api/v1/lab-receptions/", (request) =>
    request.path.includes("page_size=1&") || request.path.endsWith("page_size=1")
      ? page([], 8)
      : apiError(503, "unavailable"),
  );
  await renderApp({ path: "/lab/bags", fetch: api.fetch, language: "en" });
  await screen.findByRole("button", { name: "Try again" });
  expect(screen.getByRole("textbox", { name: "Bag code" })).toBeDefined();
  api.setRoute("GET /api/v1/lab-receptions/", page([]));
  await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("There are no records here yet");
  expect(api.requests.some((request) => request.path.startsWith("/api/v1/bags/"))).toBe(false);
});

test("deep links without bag.receive are denied before reception API reads", async () => {
  const api = receptionApi([]);
  await renderApp({ path: "/lab/bags", fetch: api.fetch, language: "en" });
  expect(screen.queryByRole("textbox", { name: "Bag code" })).toBeNull();
  expect(api.requests.map((request) => request.path)).toEqual(["/api/v1/me/"]);
});

test("switching to expected never authorizes missing from a received placeholder", async () => {
  const api = receptionApi();
  let resolve!: (reply: Response) => void;
  api.setRoute("GET /api/v1/lab-receptions/", page([receipt()]));
  api.setRoute("GET /api/v1/bags/", (request) =>
    new URL(request.path, "http://localhost").searchParams.get("page_size") === "1"
      ? page([])
      : new Promise<Response>((finish) => {
          resolve = finish;
        }),
  );
  await renderApp({ path: "/lab/bags", fetch: api.fetch, language: "en" });
  await screen.findByText("B-030");
  await userEvent
    .setup()
    .selectOptions(screen.getByRole("combobox", { name: "Laboratory state" }), "expected");
  expect(screen.queryByRole("button", { name: "Mark missing" })).toBeNull();
  expect(screen.getByRole("status", { name: "Loading content" })).toBeDefined();
  await act(async () => {
    resolve(page([bag()]));
    await Promise.resolve();
  });
  expect(
    (await screen.findByRole("button", { name: "Mark missing" })).getAttribute("aria-disabled"),
  ).toBe("false");
});

test("summary links use independent server counts and lists keep exact filters, ordering and paging", async () => {
  const api = receptionApi();
  api.setRoute("GET /api/v1/lab-receptions/", (request) =>
    page(
      [receipt()],
      new URL(request.path, "http://localhost").searchParams.get("kind") === "no_paddle" ? 2 : 47,
    ),
  );
  api.setRoute("GET /api/v1/bags/", page([], 13));
  const path = `/lab/bags?point=${READING_ID}&week=2026-W45&code=B-030&page=2&ordering=created_at`;
  await renderApp({ path, fetch: api.fetch, language: "en" });
  const summary = screen.getByRole("region", { name: /Totals are independent/ });
  const received = await within(summary).findByRole("link", { name: "47" });
  const expected = await within(summary).findByRole("link", { name: "13" });
  expect(received.getAttribute("href")).toContain("view=received");
  expect(expected.getAttribute("href")).toContain("view=expected");
  expect(received.getAttribute("href")).not.toContain("page=");
  const list = api.requests.find((request) => request.path.includes("page_size=25"));
  const params = new URL(list?.path ?? "", "http://localhost").searchParams;
  expect(Object.fromEntries(params)).toEqual({
    point: READING_ID,
    week: "2026-W45",
    code: "B-030",
    page: "2",
    page_size: "25",
    ordering: "created_at",
    kind: "bag",
  });
});
