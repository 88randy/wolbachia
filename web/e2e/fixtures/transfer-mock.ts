import type { Schemas } from "@wolbachia/api-client";
import type { Page, Route } from "@playwright/test";
import { expect } from "./test";
import { mockApi } from "./mock-api";
import { makeMe } from "../../src/test/fake-api";

export const TRANSFER_ID = "15200000-0000-4000-8000-000000000001";
export const TRANSFER_LINE = "15200000-0000-4000-8000-000000000002";
export const TRANSFER_CODE = "T-0152";
export const DISCREPANCY_CODE = "D-0152";
const DISCREPANCY_ID = "15200000-0000-4000-8000-000000000003";
const RECEIPT_ID = "15200000-0000-4000-8000-000000000004";
const SYNTHETIC_TIME = "2026-11-09T14:00:00Z";
const LOT_ID = "15200000-0000-4000-8000-000000000005";
const ORIGIN_ID = "15200000-0000-4000-8000-000000000006";
const DESTINATION_ID = "15200000-0000-4000-8000-000000000007";
const UNIT_ID = "15200000-0000-4000-8000-000000000008";
const HOLD_RESOLUTION_ID = "15200000-0000-4000-8000-000000000011";

function transferEvent(
  kind: Schemas["TransferEvent"]["kind"],
  revision: number,
): Schemas["TransferEvent"] {
  return {
    id: crypto.randomUUID(),
    transfer_id: TRANSFER_ID,
    revision,
    kind,
    command_id: crypto.randomUUID(),
    manifest: { evidence: [] },
    manifest_hash: "a".repeat(64),
    device_time: SYNTHETIC_TIME,
    server_received_at: SYNTHETIC_TIME,
    declared_source_uuid: null,
    operation_id: null,
    discrepancy_id: null,
    created_by: null,
    created_at: SYNTHETIC_TIME,
  };
}
function expectedLines(): Schemas["TransferLine"][] {
  return [
    {
      id: TRANSFER_LINE,
      lot_id: LOT_ID,
      piece_id: null,
      unit_version_id: UNIT_ID,
      quantity: "2",
      origin_version_id: crypto.randomUUID(),
      destination_version_id: crypto.randomUUID(),
    },
  ];
}
function dispatchedTransfer(): Schemas["Transfer"] {
  const lines = expectedLines();
  const dispatch = transferEvent("dispatch", 2);
  dispatch.manifest.lines = lines;
  dispatch.manifest.evidence = [
    { upload_id: crypto.randomUUID(), role: "signature", sha256: "b".repeat(64), coverage: [] },
  ];
  return {
    id: TRANSFER_ID,
    code: TRANSFER_CODE,
    origin_id: ORIGIN_ID,
    destination_id: DESTINATION_ID,
    lines,
    events: [transferEvent("prepared", 1), dispatch],
    revision: 2,
    state: "dispatched",
    outstanding: { [TRANSFER_LINE]: "2" },
    created_by: null,
    created_at: SYNTHETIC_TIME,
  };
}
function pageOf<T>(rows: T[]) {
  return { count: rows.length, next: null, previous: null, results: rows };
}
function discrepancyLines(): Schemas["DiscrepancyLine"][] {
  return [
    {
      id: "15200000-0000-4000-8000-000000000009",
      kind: "missing",
      line_id: TRANSFER_LINE,
      quantity: "1",
      observation: {},
    },
  ];
}
function ownedHolds(): Schemas["TransferHold"][] {
  return [
    {
      id: "15200000-0000-4000-8000-000000000010",
      lot_id: LOT_ID,
      location_id: DESTINATION_ID,
      piece_id: null,
      resolution_id: null,
    },
  ];
}
function receiptEvidence(body?: Schemas["ReceiveTransferRequest"]): Schemas["ManifestEvidence"][] {
  if (!body) return [];
  return [
    {
      upload_id: body.signature_upload_id,
      role: "signature",
      sha256: "c".repeat(64),
      coverage: [],
    },
    ...body.evidence_ids.map((upload_id) => ({
      upload_id,
      role: "photo" as const,
      sha256: "d".repeat(64),
      coverage: [TRANSFER_LINE],
    })),
  ];
}
function authorizeUpload(route: Route) {
  const body = route.request().postDataJSON() as Schemas["EvidenceUploadRequestRequest"];
  expect(body.context).toBeUndefined();
  const id = body.client_id;
  return route.fulfill({
    status: 201,
    json: {
      upload_id: id,
      url: `/api/v1/field/uploads/${String(id)}/content/`,
      method: "PUT",
      headers: { "Upload-Lease": "e2e-upload-lease", "Content-Type": body.content_type },
      expires_at: "2026-11-09T14:15:00Z",
    },
  });
}
export class TransferMock {
  transfer = dispatchedTransfer();
  private resolution: Schemas["TransferEvent"] | null = null;
  constructor(isPrepared = false) {
    if (isPrepared)
      this.transfer = {
        ...this.transfer,
        state: "prepared",
        revision: 1,
        events: this.transfer.events.slice(0, 1),
        outstanding: {},
      };
  }
  readonly writes: {
    method: string;
    path: string;
    body: unknown;
    csrf?: string;
    organization?: string;
  }[] = [];
  readonly reads: string[] = [];
  private record(route: Route) {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET") this.reads.push(request.url());
    else
      this.writes.push({
        method: request.method(),
        path,
        body: request.method() === "PUT" ? undefined : (request.postDataJSON() as unknown),
        csrf: request.headers()["x-csrftoken"],
        organization: request.headers()["x-organization"],
      });
    return { method: request.method(), path };
  }
  receiveFixture(body?: Schemas["ReceiveTransferRequest"]) {
    const receipt = {
      ...transferEvent("receive", 3),
      id: RECEIPT_ID,
      discrepancy_id: DISCREPANCY_ID,
    };
    receipt.manifest = {
      evidence: receiptEvidence(body),
      dispatch_event_id: this.transfer.events[1]?.id,
      received: { [TRANSFER_LINE]: "1" },
      missing: [{ line_id: TRANSFER_LINE, quantity: "1", evidence_ids: body?.evidence_ids ?? [] }],
      scanned: body?.scanned ?? [],
      duplicates: [],
      extras: [],
      discrepancy_id: DISCREPANCY_ID,
    };
    if (body) receipt.command_id = body.command_id;
    this.transfer = {
      ...this.transfer,
      state: "discrepancy",
      revision: 3,
      outstanding: { [TRANSFER_LINE]: "1" },
      events: [...this.transfer.events.slice(0, 2), receipt],
    };
    return receipt;
  }
  dispatchFixture(body: Schemas["DispatchTransferRequest"]) {
    const event = transferEvent("dispatch", 2);
    event.manifest.lines = this.transfer.lines;
    event.manifest.evidence = [
      {
        upload_id: body.signature_upload_id,
        role: "signature",
        sha256: "b".repeat(64),
        coverage: [],
      },
    ];
    const receipt = { ...event, command_id: body.command_id };
    this.transfer = {
      ...this.transfer,
      state: "dispatched",
      revision: 2,
      events: [...this.transfer.events.slice(0, 1), receipt],
      outstanding: { [TRANSFER_LINE]: "2" },
    };
    return receipt;
  }
  closeFixture(body: Schemas["CloseDiscrepancyRequest"]) {
    this.resolution = {
      ...transferEvent("resolution", 4),
      discrepancy_id: DISCREPANCY_ID,
      manifest: {
        evidence: [],
        discrepancy_id: DISCREPANCY_ID,
        reason: body.reason,
        outcomes: body.resolution.outcomes,
      },
    };
    this.transfer = {
      ...this.transfer,
      state: "resolved",
      revision: 4,
      outstanding: {},
      events: [...this.transfer.events, this.resolution],
    };
    return this.resolution;
  }
  discrepancy(): Schemas["Discrepancy"] {
    return {
      id: DISCREPANCY_ID,
      code: DISCREPANCY_CODE,
      transfer_id: TRANSFER_ID,
      transfer: this.transfer,
      receipt_event_id: RECEIPT_ID,
      lines: discrepancyLines(),
      holds: ownedHolds().map((hold) => ({
        ...hold,
        resolution_id: this.resolution ? HOLD_RESOLUTION_ID : null,
      })),
      status: this.resolution ? "closed" : "open",
      revision: this.resolution ? 1 : 0,
      resolution: this.resolution,
      created_by: null,
      created_at: SYNTHETIC_TIME,
    };
  }
  transfers = async (route: Route) => {
    const { method, path } = this.record(route);
    if (method === "POST" && path === `/api/v1/transfers/${TRANSFER_ID}/dispatch/`)
      return route.fulfill({
        status: 201,
        json: this.dispatchFixture(
          route.request().postDataJSON() as Schemas["DispatchTransferRequest"],
        ),
      });
    if (method === "POST" && path === `/api/v1/transfers/${TRANSFER_ID}/receive/`)
      return route.fulfill({
        status: 201,
        json: this.receiveFixture(
          route.request().postDataJSON() as Schemas["ReceiveTransferRequest"],
        ),
      });
    if (method !== "GET") throw new Error("Unsupported transfer fixture " + method + " " + path);
    if (path === `/api/v1/transfers/${TRANSFER_ID}/`) return route.fulfill({ json: this.transfer });
    const code = new URL(route.request().url()).searchParams.get("code");
    return route.fulfill({ json: pageOf(!code || code === TRANSFER_CODE ? [this.transfer] : []) });
  };
  discrepancies = async (route: Route) => {
    const { method, path } = this.record(route);
    if (method === "POST" && path === `/api/v1/discrepancies/${DISCREPANCY_ID}/close/`)
      return route.fulfill({
        status: 201,
        json: this.closeFixture(
          route.request().postDataJSON() as Schemas["CloseDiscrepancyRequest"],
        ),
      });
    if (method !== "GET") throw new Error("Unsupported discrepancy fixture " + method + " " + path);
    if (path === `/api/v1/discrepancies/${DISCREPANCY_ID}/`)
      return route.fulfill({ json: this.discrepancy() });
    const code = new URL(route.request().url()).searchParams.get("code");
    return route.fulfill({
      json: pageOf(!code || code === DISCREPANCY_CODE ? [this.discrepancy()] : []),
    });
  };
  uploads = async (route: Route) => {
    const { method, path } = this.record(route);
    if (method === "PUT") {
      expect(route.request().headers()["upload-lease"]).toBe("e2e-upload-lease");
      expect(route.request().postDataBuffer()?.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith("/finalize/"))
      return route.fulfill({
        json: {
          id: path.split("/").at(-3),
          state: "verified",
          verified_at: SYNTHETIC_TIME,
        },
      });
    return authorizeUpload(route);
  };
}
export async function installTransferApi(page: Page, options: { isPrepared?: boolean } = {}) {
  await page.addInitScript(() => {
    document.cookie = "csrftoken=e2e-csrf; path=/";
    localStorage.setItem("wolbachia.organization", "norte");
  });
  await mockApi(page, {
    me: makeMe({
      permissions: [
        "transfer.read",
        "transfer.dispatch",
        "transfer.receive",
        "discrepancy.read",
        "discrepancy.close",
        "field.upload",
      ],
      scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
    }),
  });
  const server = new TransferMock(options.isPrepared);
  await page.route("**/api/v1/transfers/**", server.transfers);
  await page.route("**/api/v1/discrepancies/**", server.discrepancies);
  await page.route("**/api/v1/field/uploads/**", server.uploads);
  return server;
}
