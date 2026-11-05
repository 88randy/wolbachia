import { beforeEach, describe, expect, test, vi } from "vitest";
import { createWebApiClient } from "../api/create-web-api-client";
import {
  clearExpectedAttestation,
  IDENTITY_HEADER,
  IdentityMismatchError,
  setExpectedAttestation,
  setIdentityMismatchHandler,
} from "./attestation";

const mismatch = vi.fn();

beforeEach(() => {
  mismatch.mockClear();
  clearExpectedAttestation();
  setIdentityMismatchHandler(mismatch);
});

function clientAnswering(response: () => Response) {
  const fetch = () => Promise.resolve(response());
  return createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch });
}

function get(client: ReturnType<typeof clientAnswering>, path: string): Promise<unknown> {
  return (client as unknown as { GET: (path: string) => Promise<unknown> }).GET(path);
}

const attested = (id: string | null, status = 200) =>
  new Response("{}", {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(id === null ? {} : { [IDENTITY_HEADER]: id }),
    },
  });

describe("attestation middleware", () => {
  test("a 2xx answer attested for the identity it was issued under resolves", async () => {
    setExpectedAttestation("A");

    await expect(
      get(
        clientAnswering(() => attested("A")),
        "/api/v1/devices/",
      ),
    ).resolves.toBeDefined();
    expect(mismatch).not.toHaveBeenCalled();
  });

  test("another identity never resolves: it reports the mismatch and throws", async () => {
    setExpectedAttestation("A");

    await expect(
      get(
        clientAnswering(() => attested("B")),
        "/api/v1/devices/",
      ),
    ).rejects.toBeInstanceOf(IdentityMismatchError);
    expect(mismatch).toHaveBeenCalledOnce();
  });

  test("an answer without the header cannot be attested and is rejected", async () => {
    setExpectedAttestation("A");

    await expect(
      get(
        clientAnswering(() => attested(null)),
        "/api/v1/devices/",
      ),
    ).rejects.toBeInstanceOf(IdentityMismatchError);
  });

  test("while NO value is expected every org-scoped 2xx answer is rejected, never accepted", async () => {
    await expect(
      get(
        clientAnswering(() => attested("A")),
        "/api/v1/devices/",
      ),
    ).rejects.toBeInstanceOf(IdentityMismatchError);
    expect(mismatch).toHaveBeenCalledOnce();
  });

  test("while no value is expected only /me/ and /auth/ may pass", async () => {
    await expect(
      get(
        clientAnswering(() => attested("A")),
        "/api/v1/me/",
      ),
    ).resolves.toBeDefined();
    await expect(
      get(
        clientAnswering(() => attested("A")),
        "/api/v1/auth/csrf/",
      ),
    ).resolves.toBeDefined();
    expect(mismatch).not.toHaveBeenCalled();
  });

  test("/auth/ is never compared even when a value is expected", async () => {
    setExpectedAttestation("A");

    await expect(
      get(
        clientAnswering(() => attested("B")),
        "/api/v1/auth/login/",
      ),
    ).resolves.toBeDefined();
  });

  test("error answers carry no data and are not compared", async () => {
    setExpectedAttestation("A");

    await expect(
      get(
        clientAnswering(() => attested(null, 403)),
        "/api/v1/devices/",
      ),
    ).resolves.toBeDefined();
    expect(mismatch).not.toHaveBeenCalled();
  });
});
