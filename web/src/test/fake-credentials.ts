/**
 * Passwords for tests. They are obviously fake (`pw-for-...`, the convention of
 * docs/engineering-rules.md) and generated at runtime, so no secret-looking literal sits in the
 * repository: the secret scan allows its fake-password exception only under `backend/tests/`.
 */
export function fakePassword(): string {
  return `pw-for-${crypto.randomUUID()}`;
}
