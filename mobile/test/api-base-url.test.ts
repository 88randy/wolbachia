import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPrivateLanHost, parseApiBaseUrl } from "../src/config/api-base-url.ts";

void describe("API base URL", () => {
  void it("accepts https for any host and normalizes trailing slashes and spaces", () => {
    assert.deepEqual(parseApiBaseUrl("  https://api.example.com/ "), {
      ok: true,
      url: "https://api.example.com",
    });
    assert.deepEqual(parseApiBaseUrl("https://api.example.com:8443"), {
      ok: true,
      url: "https://api.example.com:8443",
    });
  });

  void it("accepts plain http only for private LAN addresses and localhost", () => {
    for (const host of [
      "192.168.1.20",
      "10.0.2.2",
      "172.16.0.5",
      "172.31.255.1",
      "127.0.0.1",
      "localhost",
    ]) {
      assert.equal(parseApiBaseUrl(`http://${host}:8000`).ok, true, host);
    }
    for (const host of [
      "8.8.8.8",
      "172.32.0.1",
      "172.15.0.1",
      "192.169.1.1",
      "api.example.com",
      "10.0.0.256",
    ]) {
      assert.deepEqual(
        parseApiBaseUrl(`http://${host}`),
        { ok: false, problem: "cleartextNotAllowed" },
        host,
      );
    }
  });

  void it("refuses a path, a query, user info, a bad port or no address at all", () => {
    for (const input of [
      "https://api.example.com/api/v1",
      "https://api.example.com?x=1",
      "https://user@api.example.com",
      "https://api.example.com:0",
      "https://api.example.com:70000",
      "api.example.com",
      "ftp://api.example.com",
    ]) {
      assert.deepEqual(parseApiBaseUrl(input), { ok: false, problem: "invalid" }, input);
    }
    assert.deepEqual(parseApiBaseUrl(undefined), { ok: false, problem: "empty" });
    assert.deepEqual(parseApiBaseUrl("   "), { ok: false, problem: "empty" });
  });

  void it("does not treat a host that merely starts like a private range as private", () => {
    assert.equal(isPrivateLanHost("192.168.1.20.evil.com"), false);
    assert.equal(isPrivateLanHost("10.evil.com"), false);
  });
});
