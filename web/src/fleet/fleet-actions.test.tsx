import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { apiError, makeMe } from "../test/fake-api";
import {
  ALLOWED,
  GET,
  LIST,
  motorcycle,
  openFleet,
  otherReasonField,
  pageOf,
  serviceRecord,
  evidenceFile,
  fleetFault,
  historyPage,
  fleetEvidenceApi,
  settleFleet,
  chooseMenuAction,
  pickDay,
  pickOption,
  menuItem,
} from "./fleet-test-helpers";
import { createApiClient } from "@wolbachia/api-client";
import { createHash } from "node:crypto";
import { uploadFleetEvidence } from "./fleet-evidence";
import type { FleetEvidence } from "./fleet-evidence";
const VOID = `POST /api/v1/motorcycles/${motorcycle().id}/void/`;
const REASON = "Wrong registration confirmed";

describe("fleet action boundaries", () => {
  test("lost evidence verification renews the same original UUID and current-owner loss prevents byte transmission", async () => {
    const fault = fleetFault();
    const id = "00000000-0000-4000-8000-000000000023";
    const grant = {
      upload_id: id,
      url: `/api/v1/field/uploads/${id}/content/`,
      method: "PUT",
      headers: { "Upload-Lease": "synthetic-upload-lease", "Content-Type": "image/png" },
      expires_at: "2026-11-07T12:00:00Z",
    };
    const api = fleetEvidenceApi({
      "POST /api/v1/field/uploads/": () => Response.json(grant, { status: 201 }),
      [`PUT /api/v1/field/uploads/${id}/content/`]: () => new Response(null, { status: 204 }),
      [`POST /api/v1/field/uploads/${id}/finalize/`]: () => {
        throw new TypeError("Synthetic lost finalize reply");
      },
      [`POST /api/v1/field/uploads/${id}/renew/`]: () =>
        Response.json({ ...grant, id, state: "verified", verified_at: "2026-11-07T11:55:00Z" }),
    });
    const client = createApiClient({
      baseUrl: "https://test.invalid",
      auth: { kind: "session", getCsrfToken: () => "synthetic-csrf" },
      getOrganizationSlug: () => "norte",
      fetch: api.fetch,
    });
    let evidence: FleetEvidence = {
      file: evidenceFile().file,
      clientId: "00000000-0000-4000-8000-000000000025",
    };
    let current = true;
    const requireCurrent = () => {
      if (!current) throw new Error("Synthetic owner retired");
    };
    const call = () => ({
      scope: { client },
      evidence,
      fault: fault.id,
      signal: new AbortController().signal,
      requireCurrent,
      onAuthorized: (uploadId: string) => {
        evidence = { ...evidence, uploadId };
      },
    });
    await expect(uploadFleetEvidence(call())).rejects.toThrow("Synthetic lost finalize reply");
    expect(evidence.uploadId).toBe(id);
    expect(await uploadFleetEvidence(call())).toEqual({
      uploadId: id,
      verifiedAt: "2026-11-07T11:55:00Z",
    });
    expect(api.requests.filter((request) => request.method === "PUT")).toHaveLength(1);
    expect(
      api.requests.filter((request) => request.path === "/api/v1/field/uploads/"),
    ).toHaveLength(1);
    expect(
      api.requests.some((request) => request.path === `/api/v1/field/uploads/${id}/renew/`),
    ).toBe(true);
    evidence = { file: evidenceFile().file, clientId: "00000000-0000-4000-8000-000000000026" };
    const retired = {
      ...call(),
      onAuthorized: () => {
        current = false;
      },
    };
    await expect(uploadFleetEvidence(retired)).rejects.toThrow("Synthetic owner retired");
    expect(api.requests.filter((request) => request.method === "PUT")).toHaveLength(1);
    current = true;
    const beforeInvalid = api.requests.length;
    const badHeader = new File([Uint8Array.of(0, 1, 2)], "wrong.png", { type: "image/png" });
    Object.defineProperty(badHeader, "arrayBuffer", {
      value: () => Promise.resolve(Uint8Array.of(0, 1, 2).buffer),
    });
    for (const file of [new File(["wrong"], "wrong.txt", { type: "text/plain" }), badHeader]) {
      evidence = { file, clientId: "00000000-0000-4000-8000-000000000027" };
      await expect(uploadFleetEvidence(call())).rejects.toThrow(/Invalid fleet evidence/);
    }
    expect(api.requests).toHaveLength(beforeInvalid);
    for (const unsafe of [
      { ...grant, method: "GET" },
      { ...grant, url: "https://foreign.invalid/bytes" },
    ]) {
      api.setRoute("POST /api/v1/field/uploads/", Response.json(unsafe));
      evidence = { file: evidenceFile().file, clientId: "00000000-0000-4000-8000-000000000028" };
      await expect(uploadFleetEvidence(call())).rejects.toThrow("Invalid fleet upload authority");
    }
    expect(api.requests.filter((request) => request.method === "PUT")).toHaveLength(1);
  });
  test("verified fault evidence uses one exact parent and explicit revision review while other blockers remain", async () => {
    const fault = fleetFault();
    const upload = "00000000-0000-4000-8000-000000000023";
    let current = motorcycle({ revision: 5 });
    let clearAttempts = 0;
    let release: (response: Response) => void = () => undefined;
    const verification = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const clearMe = makeMe({
      permissions: ["motorcycle.read", "motorcycle.service_clear", "field.upload"],
      scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "none", ids: [] } },
    });
    const { api, app, reads } = await openFleet({
      path: `${LIST}/M-03?tab=incidents`,
      me: clearMe,
      routes: {
        [GET]: () => pageOf([current]),
        "GET /api/v1/incidents/": () => historyPage([fault]),
        "POST /api/v1/field/uploads/": () =>
          Response.json(
            {
              upload_id: upload,
              url: `/api/v1/field/uploads/${upload}/content/`,
              method: "PUT",
              headers: { "Upload-Lease": "synthetic-upload-lease", "Content-Type": "image/png" },
              expires_at: "2026-11-07T12:00:00Z",
            },
            { status: 201 },
          ),
        [`PUT /api/v1/field/uploads/${upload}/content/`]: () => new Response(null, { status: 204 }),
        [`POST /api/v1/field/uploads/${upload}/finalize/`]: () => verification,
        [`POST /api/v1/motorcycles/${current.id}/clear-fault/`]: () => {
          current = motorcycle({
            revision: ++clearAttempts === 1 ? 6 : 7,
            is_blocked: true,
            blocked_reason: "service_overdue",
          });
          return clearAttempts === 1
            ? apiError(409, "motorcycle_revision_conflict")
            : Response.json(current);
        },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Liberar esta falla grave" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(
      dialog.getByRole("textbox", { name: "Motivo de la inspección" }),
      "Named inspection and original proof",
    );
    const original = evidenceFile();
    await userEvent.upload(dialog.getByLabelText("Evidencia JPEG/PNG"), original.file);
    expect(
      dialog
        .getByRole("button", { name: "Liberar esta falla grave" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    await userEvent.click(dialog.getByRole("button", { name: "Cargar y verificar evidencia" }));
    await waitFor(() => {
      expect(api.requests.some((request) => request.path.endsWith("/finalize/"))).toBe(true);
    });
    expect(clearAttempts).toBe(0);
    await act(async () => {
      release(
        Response.json({ id: upload, state: "verified", verified_at: "2026-11-07T11:55:00Z" }),
      );
      await verification;
    });
    await dialog.findByText(/Evidencia verificada/);
    const metadata = api.requests.find(
      (request) => request.path === "/api/v1/field/uploads/",
    )?.body;
    expect(metadata).toMatchObject({
      content_type: "image/png",
      size_bytes: original.bytes.length,
      context: { kind: "motorcycle_fault", id: fault.id },
    });
    expect(metadata).toHaveProperty(
      "sha256",
      createHash("sha256").update(original.bytes).digest("hex"),
    );
    const put = api.requests.find((request) => request.method === "PUT");
    expect(put?.body).toEqual(original.bytes);
    expect(put?.headers.get("Upload-Lease")).toBe("synthetic-upload-lease");
    const writeBoundary = reads.length;
    await userEvent.click(dialog.getByRole("button", { name: "Liberar esta falla grave" }));
    await dialog.findByRole("button", { name: "Revisar estado actual y conservar captura" });
    const refreshed = await settleFleet({ api, app, reads }, { since: writeBoundary, me: clearMe });
    expect(refreshed).toHaveProperty("revision", 6);
    await settleFleet(
      { api, app, reads },
      { since: writeBoundary, me: clearMe, kind: "incidents" },
    );
    expect(dialog.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
      "Named inspection and original proof",
    );
    expect(clearAttempts).toBe(1);
    await waitFor(() => {
      expect(
        dialog
          .getByRole("button", { name: "Revisar estado actual y conservar captura" })
          .getAttribute("aria-disabled"),
      ).toBe("false");
    });
    const reviewBoundary = reads.length;
    await userEvent.click(
      dialog.getByRole("button", { name: "Revisar estado actual y conservar captura" }),
    );
    await settleFleet({ api, app, reads }, { since: reviewBoundary, me: clearMe });
    await settleFleet(
      { api, app, reads },
      { since: reviewBoundary, me: clearMe, kind: "incidents" },
    );
    await waitFor(() => {
      expect(dialog.queryByText(/El estado cambió/)).toBeNull();
    });
    expect(clearAttempts).toBe(1);
    await userEvent.click(dialog.getByRole("button", { name: "Liberar esta falla grave" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    const attempts = api.requests.filter((request) => request.path.endsWith("/clear-fault/"));
    expect(attempts.map((request) => request.body)).toEqual(
      [5, 6].map((expected_revision) => ({
        fault_id: fault.id,
        expected_revision,
        evidence_ids: [upload],
        reason: "Named inspection and original proof",
      })),
    );
    await screen.findByText(/Servicio vencido/);
    expect(screen.queryByText("Disponible")).toBeNull();
  });
  test("inspection registration uses the real service body without changing a severe fault", async () => {
    const servicePath = `/api/v1/motorcycles/${motorcycle().id}/services/`;
    let service = serviceRecord();
    const { api } = await openFleet({
      path: `${LIST}/M-03`,
      me: makeMe({
        permissions: ["motorcycle.read", "motorcycle.manage"],
        scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "none", ids: [] } },
      }),
      routes: {
        [`POST ${servicePath}`]: () => Response.json(serviceRecord(), { status: 201 }),
        [`GET ${servicePath}`]: () => historyPage([service]),
        [`POST ${servicePath}${service.id}/void/`]: () => {
          service = serviceRecord({
            voided_at: "2026-11-07T12:00:00Z",
            void_reason: REASON,
            void_reason_code: "other",
          });
          return Response.json(service);
        },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Registrar servicio" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(dialog.getByRole("spinbutton", { name: "Odómetro (km)" }), "-1");
    await userEvent.tab();
    expect(
      dialog.getByRole("spinbutton", { name: "Odómetro (km)" }).getAttribute("aria-invalid"),
    ).toBe("true");
    await userEvent.click(dialog.getByRole("button", { name: "Registrar servicio" }));
    expect(api.requests.some((request) => request.method === "POST")).toBe(false);
    await userEvent.clear(dialog.getByRole("spinbutton", { name: "Odómetro (km)" }));
    await pickOption(dialog, "Tipo de servicio", "Inspección");
    await pickDay(dialog, "Fecha del servicio", "2026-11-01");
    await userEvent.type(dialog.getByRole("spinbutton", { name: "Odómetro (km)" }), "12600");
    await userEvent.type(
      dialog.getByRole("textbox", { name: "Observaciones" }),
      "Inspection recorded separately",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Registrar servicio" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    const writes = api.requests.filter((request) => request.method === "POST");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.path).toBe(servicePath);
    expect(writes[0]?.body).toEqual({
      kind: "inspection",
      performed_at: "2026-11-01",
      odometer_km: 12600,
      notes: "Inspection recorded separately",
      service_interval_km: null,
      service_interval_days: null,
    });
    await screen.findByText(/Revisión con falla grave/);
    expect(api.requests.some((request) => request.path.endsWith("/clear-fault/"))).toBe(false);
    await userEvent.click(screen.getByRole("link", { name: "Servicios" }));
    const table = within(await screen.findByRole("table", { name: "Servicios" }));
    await userEvent.click(table.getByRole("button", { name: "Anular" }));
    await userEvent.type(await otherReasonField(), REASON);
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Anular" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await screen.findByText(new RegExp(REASON));
    expect(
      api.requests
        .filter((request) => request.path === `${servicePath}${service.id}/void/`)
        .map((request) => request.body),
    ).toEqual([{ reason_code: "other", reason: REASON }]);
    expect(screen.getByText(/Revisión con falla grave/)).toBeDefined();
  });
  test("read permission does not expose void or unblock controls", async () => {
    const proof = fleetFault({
      is_cleared: true,
      cleared_at: "2026-11-01T15:00:00Z",
      clearance: {
        id: "00000000-0000-4000-8000-000000000024",
        created_at: "2026-11-01T15:00:00Z",
        reviewer: ALLOWED.user.id,
        reason: "Synthetic historical inspection proof",
        evidence_ids: ["00000000-0000-4000-8000-000000000023"],
      },
    });
    const { api, app, reads } = await openFleet({
      path: `${LIST}/M-03?tab=incidents`,
      me: makeMe({ ...ALLOWED, permissions: ["motorcycle.read"] }),
      routes: {
        "GET /api/v1/incidents/": () =>
          historyPage([proof, fleetFault({ id: "00000000-0000-4000-8000-000000000035" })]),
      },
    });
    await screen.findByRole("heading", { name: "M-03" });
    await screen.findByRole("table", { name: "Incidentes" });
    expect(screen.queryByRole("button", { name: "Anular" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desbloquear" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar servicio" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Liberar esta falla grave" })).toBeNull();
    expect(screen.getByText("Synthetic historical inspection proof")).toBeDefined();
    expect(api.requests.some((request) => request.path.includes("/field/uploads/"))).toBe(false);
    const authorityBoundary = reads.length;
    const nextMe = makeMe({
      ...ALLOWED,
      permissions: ["motorcycle.read", "motorcycle.service_clear"],
    });
    api.setRoute("GET /api/v1/me/", Response.json(nextMe));
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    await settleFleet({ api, app, reads }, { since: authorityBoundary, me: nextMe });
    await settleFleet(
      { api, app, reads },
      { since: authorityBoundary, me: nextMe, kind: "incidents" },
    );
    await screen.findByRole("table", { name: "Incidentes" });
    expect(screen.queryByRole("button", { name: "Liberar esta falla grave" })).toBeNull();
    expect(api.requests.some((request) => request.method === "POST")).toBe(false);
  });
  test.each([false, true])(
    "state-blocked actions have a visible description: voided=%s",
    async (isVoided) => {
      const item = motorcycle({
        is_blocked: false,
        blocked_reason: "",
        voided_at: isVoided ? "2026-10-02T12:00:00Z" : null,
      });
      await openFleet({ path: `${LIST}/M-03`, routes: { [GET]: pageOf([item]) } });
      const unblock = await menuItem(/^Desbloquear/);
      expect(unblock.getAttribute("aria-disabled")).toBe("true");
      expect(unblock.textContent).toContain(isVoided ? "está anulada" : "no está bloqueada");
      await userEvent.click(unblock);
      expect(screen.queryByRole("dialog")).toBeNull();
      if (isVoided) expect((await menuItem(/^Anular/)).getAttribute("aria-disabled")).toBe("true");
    },
  );
  test.each([false, true])(
    "void success or concurrent already_voided refreshes the record: concurrent=%s",
    async (isConcurrent) => {
      let item = motorcycle();
      await openFleet({
        path: `${LIST}/M-03`,
        routes: {
          [GET]: () => pageOf([item]),
          [VOID]: () => {
            item = motorcycle({ voided_at: "2026-10-02T12:00:00Z", void_reason: REASON });
            return isConcurrent ? apiError(409, "already_voided") : Response.json(item);
          },
        },
      });
      await chooseMenuAction("Anular");
      await userEvent.type(await otherReasonField(), REASON);
      await userEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Anular" }),
      );
      await screen.findByText("Anulada");
      if (isConcurrent) {
        expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(REASON);
        expect(within(screen.getByRole("dialog")).getByRole("alert").textContent).toContain(
          "ya anuló",
        );
      } else expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByText("Disponible")).toBeNull();
    },
  );
  test("local unblock wording does not change the next void dialog", async () => {
    await openFleet({ path: `${LIST}/M-03` });
    await chooseMenuAction("Desbloquear");
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }),
    );
    await chooseMenuAction("Anular");
    expect(screen.getByRole("dialog", { name: "Anular M-03" })).toBeDefined();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Anular" }),
    ).toBeDefined();
    expect(screen.queryByText("Motivo y evidencia")).toBeNull();
  });
  test("create success refreshes the list and announces the saved motorcycle", async () => {
    let created = false;
    await openFleet({
      routes: {
        [GET]: () => pageOf(created ? [motorcycle({ code: "M-NEW" })] : []),
        "POST /api/v1/motorcycles/": () => {
          created = true;
          return Response.json(motorcycle({ code: "M-NEW" }), { status: 201 });
        },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Alta de moto" }));
    await userEvent.type(
      within(screen.getByRole("dialog")).getByRole("textbox", { name: "Código" }),
      "M-NEW",
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Guardar" }),
    );
    await screen.findByRole("link", { name: "M-NEW" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByText("Cambio guardado.").getAttribute("role")).toBe("status");
  });
});
