import { describe, expect, test } from "vitest";
import { API_BASE_URL_VARIABLE, readAppConfig } from "./app-config";

function envWith(value: unknown): Record<string, unknown> {
  return { [API_BASE_URL_VARIABLE]: value };
}

describe("readAppConfig", () => {
  test("rejects a missing variable and names it", () => {
    const result = readAppConfig({});

    expect(result).toEqual({
      ok: false,
      variable: "VITE_API_BASE_URL",
      problem: "missing or empty",
    });
  });

  test.each(["", "   "])("rejects an empty value %j", (value) => {
    expect(readAppConfig(envWith(value)).ok).toBe(false);
  });

  test.each([
    "not a url",
    "//evil.example.com/api",
    "ftp://files.example.com",
    "javascript:alert(1)",
    "api/v1",
    "/\\evil.example.com",
    "/api\\v1",
  ])("rejects an invalid value %j", (value) => {
    expect(readAppConfig(envWith(value)).ok).toBe(false);
  });

  test("requires https for absolute URLs in production builds", () => {
    const env = { [API_BASE_URL_VARIABLE]: "http://api.example.com/api/v1", PROD: true };

    expect(readAppConfig(env)).toEqual({
      ok: false,
      variable: "VITE_API_BASE_URL",
      problem: "must use https in production",
    });
  });

  test("accepts https and same-origin paths in production builds", () => {
    expect(
      readAppConfig({ [API_BASE_URL_VARIABLE]: "https://api.example.com", PROD: true }).ok,
    ).toBe(true);
    expect(readAppConfig({ [API_BASE_URL_VARIABLE]: "/api/v1", PROD: true }).ok).toBe(true);
  });

  test("allows http in development (localhost backend)", () => {
    const env = { [API_BASE_URL_VARIABLE]: "http://localhost:8000/api/v1", PROD: false };

    expect(readAppConfig(env).ok).toBe(true);
  });

  test("rejects a value that is not a string", () => {
    expect(readAppConfig(envWith(42)).ok).toBe(false);
  });

  test.each([
    ["/api/v1", "/api/v1"],
    ["/api/v1/", "/api/v1"],
    ["https://api.example.com/api/v1", "https://api.example.com/api/v1"],
    ["http://localhost:8000/api/v1/", "http://localhost:8000/api/v1"],
    ["  /api/v1  ", "/api/v1"],
  ])("accepts %j as %j", (value, expected) => {
    expect(readAppConfig(envWith(value))).toEqual({ ok: true, config: { apiBaseUrl: expected } });
  });
});
