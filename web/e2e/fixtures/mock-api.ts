import type { Page, Route } from "@playwright/test";
import type { Me } from "../../src/session/me";
import { makeMe } from "../../src/test/fake-api";
import { FakeDevices } from "./devices-mock";
import type { PhoneFixture } from "./devices-mock";

/** Fake password for the e2e runs: obviously fake (`pw-for-...`) and generated at runtime. */
export const E2E_PASSWORD = `pw-for-${crypto.randomUUID()}`;
const CSRF_VALUE = "e2e-csrf";
const DEFAULT_RETRY_AFTER_SECONDS = 900;

export type LoginBehavior = "ok" | "invalid" | "locked" | "no-membership";
export type ResetBehavior = "ok" | "invalid-link" | "too-short" | "too-common";

export interface MockApiOptions {
  /** Who is signed in when the page opens; `null` for nobody. */
  me?: Me | null;
  /** What `POST /auth/login/` answers; `ok` signs in `signInAs`. */
  login?: LoginBehavior;
  /** User that signs in on a successful login (default: the same as `me`, or `makeMe()`). */
  signInAs?: Me;
  retryAfterSeconds?: number;
  resetConfirm?: ResetBehavior;
  /** Phones `GET /devices/` lists (W67). Default: none. */
  devices?: readonly PhoneFixture[];
}

export interface RecordedRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

/** What a test can read and change while the page is open. */
export interface MockApi {
  requests: RecordedRequest[];
  /** Hold or fail the answers of `GET /devices/` (loading and error states). */
  devices: Pick<FakeDevices, "hold" | "setFailing">;
  /** The server forgets the session (it expired): the next `/me/` is 401. */
  expireSession: () => void;
  setLogin: (behavior: LoginBehavior) => void;
}

function envelope(status: number, code: string, extra: Record<string, unknown> = {}) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify({ code, detail: `Fake ${code}.`, ...extra }),
  };
}

function weakPassword(code: string) {
  return envelope(400, "validation_error", { fields: { new_password: [{ code, params: {} }] } });
}

function confirmReply(behavior: ResetBehavior) {
  if (behavior === "invalid-link") return envelope(400, "invalid_reset_token");
  if (behavior === "too-short") return weakPassword("password_too_short");
  if (behavior === "too-common") return weakPassword("password_too_common");
  return { status: 204 };
}

/** `Me` as the API answers it: a multi-organization user without the header has none active. */
function meFor(user: Me, slug: string | undefined): Me {
  if (user.organizations.length < 2) return user;
  const chosen = user.organizations.find((organization) => organization.slug === slug);
  if (chosen === undefined || user.organization === null) {
    return { ...user, organization: null, profiles: [], permissions: [] };
  }
  return { ...user, organization: { ...user.organization, ...chosen } };
}

/** The server side of one test: who is signed in, what login answers, and the request log. */
class FakeServer implements MockApi {
  readonly requests: RecordedRequest[] = [];
  readonly devices: FakeDevices;
  private signedIn: Me | null;
  private login: LoginBehavior;

  constructor(
    private readonly page: Page,
    private readonly options: MockApiOptions,
  ) {
    this.devices = new FakeDevices(options.devices ?? []);
    this.signedIn = options.me === undefined ? makeMe() : options.me;
    this.login = options.login ?? "ok";
  }

  expireSession = (): void => {
    this.signedIn = null;
  };

  setLogin = (behavior: LoginBehavior): void => {
    this.login = behavior;
  };

  private record(route: Route): RecordedRequest {
    const request = route.request();
    const raw = request.postData();
    const recorded = {
      method: request.method(),
      path: new URL(request.url()).pathname,
      headers: request.headers(),
      body: raw === null ? undefined : (JSON.parse(raw) as unknown),
    };
    this.requests.push(recorded);
    return recorded;
  }

  private answerMe(route: Route, request: RecordedRequest) {
    if (this.signedIn === null) return route.fulfill(envelope(401, "not_authenticated"));
    return route.fulfill({ json: meFor(this.signedIn, request.headers["x-organization"]) });
  }

  private answerLogin(route: Route, request: RecordedRequest) {
    if (request.headers["x-csrftoken"] !== CSRF_VALUE) {
      return route.fulfill(envelope(403, "permission_denied"));
    }
    if (this.login === "invalid") return route.fulfill(envelope(401, "invalid_credentials"));
    if (this.login === "no-membership") return route.fulfill(envelope(403, "no_active_membership"));
    if (this.login === "locked") {
      const seconds = this.options.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS;
      return route.fulfill({
        ...envelope(429, "throttled"),
        headers: { "Retry-After": String(seconds) },
      });
    }
    this.signedIn = this.options.signInAs ?? this.options.me ?? makeMe();
    const me = meFor(this.signedIn, request.headers["x-organization"]);
    return route.fulfill({ json: { me, server_time: "2026-11-04T12:00:00Z" } });
  }

  /** Like Django's `Set-Cookie: csrftoken=...; Path=/`: readable by the page on every path. */
  private async setCsrfCookie(requestUrl: string): Promise<void> {
    const { hostname } = new URL(requestUrl);
    await this.page
      .context()
      .addCookies([{ name: "csrftoken", value: CSRF_VALUE, domain: hostname, path: "/" }]);
  }

  async handle(route: Route): Promise<void> {
    const request = this.record(route);
    switch (`${request.method} ${request.path}`) {
      case "GET /api/v1/auth/csrf/":
        await this.setCsrfCookie(route.request().url());
        return route.fulfill({ status: 204 });
      case "GET /api/v1/me/":
        return this.answerMe(route, request);
      case "GET /api/v1/devices/":
        return this.devices.answer(route);
      case "POST /api/v1/auth/login/":
        return this.answerLogin(route, request);
      case "POST /api/v1/auth/logout/":
        this.signedIn = null;
        return route.fulfill({ status: 204 });
      case "POST /api/v1/auth/password-reset/":
        return route.fulfill({ status: 202 });
      case "POST /api/v1/auth/password-reset/confirm/":
        return route.fulfill(confirmReply(this.options.resetConfirm ?? "ok"));
      default:
        return route.fulfill(envelope(404, "not_found"));
    }
  }
}

/**
 * Fakes the whole API of the web app with `page.route` (no MSW): CSRF, login, `/me/`, logout and
 * the password reset. Anything else is a 404 so a forgotten call shows up in the test.
 */
export async function mockApi(page: Page, options: MockApiOptions = {}): Promise<MockApi> {
  const server = new FakeServer(page, options);
  await page.route("**/api/v1/**", (route) => server.handle(route));
  return server;
}
