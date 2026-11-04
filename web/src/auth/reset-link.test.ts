import { describe, expect, test } from "vitest";
import { parseResetFragment, toResetLink } from "./reset-link";

describe("toResetLink", () => {
  test("accepts values shaped like ours", () => {
    expect(toResetLink("MQ", "abc123-fake_token")).toEqual({
      uid: "MQ",
      token: "abc123-fake_token",
    });
  });

  test.each([
    ["", "abc"],
    ["MQ", ""],
    ["M Q", "abc"],
    ["MQ", "a.b"],
    ["MQ", "a/b"],
    ["MQ", "a".repeat(129)],
  ])("rejects uid %j with token %j", (uid, token) => {
    expect(toResetLink(uid, token)).toBeUndefined();
  });
});

describe("parseResetFragment", () => {
  test.each([
    ["#uid=MQ&token=abc123-fake-token", "MQ", "abc123-fake-token"],
    ["uid=MQ&token=set-password-link", "MQ", "set-password-link"],
    ["#token=a_b-c&uid=Zm9v&extra=ignored", "Zm9v", "a_b-c"],
  ])("reads %s", (hash, uid, token) => {
    expect(parseResetFragment(hash)).toEqual({ uid, token });
  });

  test.each([
    ["an empty fragment", ""],
    ["only the hash sign", "#"],
    ["no token", "#uid=MQ"],
    ["no uid", "#token=abc-123"],
    ["empty values", "#uid=&token="],
    ["a repeated uid", "#uid=MQ&uid=Mg&token=abc"],
    ["a repeated token", "#uid=MQ&token=abc&token=def"],
    ["a value with unsafe characters", "#uid=MQ&token=abc%2F..%2Fdef"],
    ["a value with markup", "#uid=MQ&token=%3Cscript%3E"],
    ["a value that is too long", `#uid=MQ&token=${"a".repeat(129)}`],
    ["a fragment that is not a query string", "#/reset-password/MQ/abc"],
  ])("rejects %s", (_name, hash) => {
    expect(parseResetFragment(hash)).toBeUndefined();
  });
});
