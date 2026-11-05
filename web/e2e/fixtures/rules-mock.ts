import type { Schemas } from "@wolbachia/api-client";
import { makeVoidReasonItems } from "../../src/test/fake-api";
import type { Route } from "@playwright/test";

export type ParameterFixture = Schemas["RuleParameter"];
export type VersionFixture = Schemas["RuleParameterVersion"];

/**
 * The server's clock for the rules mock. Fixed, so the statuses ("scheduled", "in force") and the
 * "today" of the date rules never depend on the day the tests run.
 */
export const RULES_NOW = "2026-11-04T18:00:00Z";
const TODAY = "2026-11-04";
const PAGE_SIZE_DEFAULT = 50;

/** A version of the fixtures: the first one of a parameter, in force since the start of 2026. */
export function makeRuleVersion(overrides: Partial<VersionFixture> = {}): VersionFixture {
  return {
    id: crypto.randomUUID(),
    value: 7,
    effective_from: "2026-01-01T06:00:00Z",
    effective_date: "2026-01-01",
    reason: "seed: design brief",
    status: "in_force",
    created_by: null,
    created_by_username: null,
    created_at: "2026-01-01T06:00:00Z",
    voided_at: null,
    voided_by: null,
    voided_by_username: null,
    void_reason_code: "",
    void_reason: "",
    ...overrides,
  };
}

/** A parameter definition; its value in force is worked out from its versions, like the API does. */
export function makeRuleParameter(overrides: Partial<ParameterFixture> = {}): ParameterFixture {
  return {
    key: "max_distance_to_point_m",
    value_type: "integer",
    unit: "m",
    min_value: 0,
    max_value: 500,
    value: null,
    effective_from: null,
    version_id: null,
    next_change_at: null,
    ...overrides,
  };
}

export interface RuleParameterFixture {
  parameter: ParameterFixture;
  versions: VersionFixture[];
}

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/** A field refused by the server: `{field, code, params}` in a `400 validation_error`. */
interface Refusal {
  field: string;
  code: string;
  params?: Record<string, unknown>;
}

function refuse(route: Route, { field, code, params = {} }: Refusal) {
  return json(route, 400, {
    code: "validation_error",
    detail: `Fake ${code}.`,
    fields: { [field]: [{ code, params }] },
  });
}

const isLive = (version: VersionFixture) => version.voided_at === null;
const byNewest = (a: VersionFixture, b: VersionFixture) =>
  b.effective_from.localeCompare(a.effective_from);

/**
 * `/rule-parameters/...` of the mocked server, with the rules of the real endpoints (decision 42):
 * a version for today takes effect now, a future one is scheduled, a past date and a second
 * version for the same future date are refused, the value is checked against the limits, and only
 * a scheduled version can be voided. The state is kept in memory, so a journey sees its own changes.
 */
export class FakeRules {
  constructor(
    private readonly fixtures: RuleParameterFixture[],
    private readonly signedIn: { id: string; username: string },
  ) {}

  private find(key: string): RuleParameterFixture | undefined {
    return this.fixtures.find(({ parameter }) => parameter.key === key);
  }

  private statusOf(version: VersionFixture, inForce: VersionFixture | undefined) {
    if (!isLive(version)) return "voided";
    if (version.effective_from > RULES_NOW) return "scheduled";
    return version.id === inForce?.id ? "in_force" : "superseded";
  }

  private historyOf({ versions }: RuleParameterFixture): VersionFixture[] {
    const started = versions.filter((v) => isLive(v) && v.effective_from <= RULES_NOW);
    const inForce = [...started].sort(byNewest)[0];
    return [...versions]
      .sort(byNewest)
      .map((version) => ({ ...version, status: this.statusOf(version, inForce) }));
  }

  private currentOf(fixture: RuleParameterFixture): ParameterFixture {
    const history = this.historyOf(fixture);
    const inForce = history.find((version) => version.status === "in_force");
    const upcoming = history.filter((version) => version.status === "scheduled").reverse()[0];
    return {
      ...fixture.parameter,
      value: inForce?.value ?? null,
      effective_from: inForce?.effective_from ?? null,
      version_id: inForce?.id ?? null,
      next_change_at: upcoming?.effective_from ?? null,
    };
  }

  private valueRefusal({ parameter }: RuleParameterFixture, value: number): Refusal | undefined {
    const { min_value: min, max_value: max } = parameter;
    if (parameter.value_type === "integer" && !Number.isInteger(value)) {
      return { field: "value", code: "not_an_integer" };
    }
    if ((min !== null && value < min) || (max !== null && value > max)) {
      return { field: "value", code: "out_of_range", params: { min, max } };
    }
    return undefined;
  }

  private dateRefusal({ versions }: RuleParameterFixture, date: string): Refusal | undefined {
    if (date < TODAY) return { field: "effective_from", code: "effective_from_in_past" };
    const isTaken = versions.some((v) => isLive(v) && v.effective_date === date);
    if (date > TODAY && isTaken) {
      return { field: "effective_from", code: "duplicate_effective_date" };
    }
    return undefined;
  }

  /** The first rule the body breaks, as the real endpoint checks them; `undefined` when none. */
  private refusalOf(fixture: RuleParameterFixture, body: Record<string, string>) {
    return (
      this.valueRefusal(fixture, Number(body["value"])) ??
      this.dateRefusal(fixture, body["effective_from"] ?? "")
    );
  }

  private create(route: Route, fixture: RuleParameterFixture, body: Record<string, string>) {
    const refusal = this.refusalOf(fixture, body);
    if (refusal !== undefined) return refuse(route, refusal);
    const date = body["effective_from"] ?? "";
    const version = makeRuleVersion({
      value: Number(body["value"]),
      effective_from: date === TODAY ? RULES_NOW : `${date}T06:00:00Z`,
      effective_date: date,
      reason: body["reason"] ?? "",
      created_by: this.signedIn.id,
      created_by_username: this.signedIn.username,
      created_at: RULES_NOW,
    });
    fixture.versions.push(version);
    return json(route, 201, version);
  }

  private voidVersion(
    route: Route,
    fixture: RuleParameterFixture,
    target: { id: string; reason: string; reasonCode: string },
  ) {
    const version = fixture.versions.find((candidate) => candidate.id === target.id);
    if (version === undefined) return json(route, 404, { code: "not_found", detail: "Fake." });
    if (version.effective_from <= RULES_NOW) {
      return json(route, 409, { code: "version_not_scheduled", detail: "Fake." });
    }
    const item = makeVoidReasonItems().find(
      (candidate) => candidate.is_active && candidate.code === target.reasonCode,
    );
    if (item === undefined)
      return json(route, 400, {
        code: "validation_error",
        detail: "Fake.",
        fields: { reason_code: [{ code: "void_reason_code_unknown", params: {} }] },
      });
    const voided = {
      voided_at: RULES_NOW,
      voided_by: this.signedIn.id,
      voided_by_username: this.signedIn.username,
      void_reason_code: target.reasonCode,
      void_reason: item.is_other ? target.reason : item.label_es,
    };
    return json(route, 200, Object.assign(version, voided));
  }

  catalog(route: Route): Promise<void> {
    const results = makeVoidReasonItems();
    return json(route, 200, { count: results.length, next: null, previous: null, results });
  }

  async answer(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const [, , , key, section, id, action] = url.pathname.split("/").filter(Boolean);
    const body =
      request.postData() === null
        ? {}
        : (JSON.parse(request.postData() ?? "{}") as Record<string, string>);
    if (key === undefined) return this.list(route, url.searchParams);
    const fixture = this.find(key);
    if (fixture === undefined) return json(route, 404, { code: "not_found", detail: "Fake." });
    if (section === undefined) return json(route, 200, this.currentOf(fixture));
    if (request.method() === "GET") return this.versions(route, fixture, url.searchParams);
    if (id === undefined) return this.create(route, fixture, body);
    if (action !== "void") return json(route, 405, {});
    return this.voidVersion(route, fixture, this.voidTarget(id, body));
  }

  private voidTarget(id: string, body: Record<string, string>) {
    return { id, reason: body["reason"] ?? "", reasonCode: body["reason_code"] ?? "" };
  }

  private list(route: Route, query: URLSearchParams) {
    const results = this.fixtures.map((fixture) => this.currentOf(fixture));
    return this.page(route, results, query);
  }

  private versions(route: Route, fixture: RuleParameterFixture, query: URLSearchParams) {
    const includeVoided = query.get("include_voided") === "true";
    const history = this.historyOf(fixture).filter((version) => includeVoided || isLive(version));
    return this.page(route, history, query);
  }

  private page(route: Route, rows: unknown[], query: URLSearchParams) {
    const size = Number(query.get("page_size") ?? PAGE_SIZE_DEFAULT);
    const page = Number(query.get("page") ?? "1");
    const results = rows.slice((page - 1) * size, page * size);
    return json(route, 200, { count: rows.length, next: null, previous: null, results });
  }
}
