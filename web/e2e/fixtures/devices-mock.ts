import type { Schemas } from "@wolbachia/api-client";
import type { Route } from "@playwright/test";

export type PhoneFixture = Schemas["Device"];

const DEFAULT_PAGE_SIZE = 50;

/** A phone as `GET /devices/` returns it. Names and serials are obviously fake. */
export function makePhone(overrides: Partial<PhoneFixture> = {}): PhoneFixture {
  return {
    id: crypto.randomUUID(),
    label: "Teléfono de pruebas",
    serial: "SN-FAKE-0001",
    app_version: "1.4.0",
    last_seen_at: "2026-11-04T03:30:00Z",
    last_user: crypto.randomUUID(),
    last_user_username: "luis",
    is_revoked: false,
    revoked_at: null,
    revoked_by: null,
    created_at: "2026-10-01T15:00:00Z",
    ...overrides,
  };
}

/** `n` distinct phones, `Teléfono 01`, `Teléfono 02`, ... */
export function makePhones(count: number): PhoneFixture[] {
  return Array.from({ length: count }, (_unused, index) =>
    makePhone({
      label: `Teléfono ${String(index + 1).padStart(2, "0")}`,
      serial: `SN-FAKE-${String(index + 1).padStart(4, "0")}`,
    }),
  );
}

/**
 * `GET /api/v1/devices/` of the mocked server: page-number paging and the `is_revoked` filter as
 * the real endpoint has them. A test can hold the answer (a deferred promise, no timers) to see
 * the loading state, or make it fail to see the error state.
 */
export class FakeDevices {
  private gate: Promise<void> | null = null;
  private isFailing = false;

  constructor(private readonly phones: readonly PhoneFixture[]) {}

  /** Holds every answer until the returned function is called. */
  hold = (): (() => void) => {
    let release: () => void = () => undefined;
    this.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    return () => {
      this.gate = null;
      release();
    };
  };

  setFailing = (isFailing: boolean): void => {
    this.isFailing = isFailing;
  };

  async answer(route: Route): Promise<void> {
    if (this.gate !== null) await this.gate;
    if (this.isFailing) {
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: "server_error", detail: "Fake server_error." }),
      });
    }
    const query = new URL(route.request().url()).searchParams;
    const revoked = query.get("is_revoked");
    const matching =
      revoked === null
        ? this.phones
        : this.phones.filter((phone) => phone.is_revoked === (revoked === "true"));
    const size = Number(query.get("page_size") ?? DEFAULT_PAGE_SIZE);
    const page = Number(query.get("page") ?? "1");
    const results = matching.slice((page - 1) * size, page * size);
    if (results.length === 0 && page > 1) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ code: "not_found", detail: "Fake not_found." }),
      });
    }
    return route.fulfill({
      json: { count: matching.length, next: null, previous: null, results },
    });
  }
}
