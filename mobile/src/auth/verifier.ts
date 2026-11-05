import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

import { toHex } from "../db/encrypted-database.ts";

export interface Verifier {
  readonly v: 1;
  readonly iterations: number;
  readonly salt: string;
  readonly hash: string;
}

// Pure JS PBKDF2 runs without a JIT on Hermes: 20 000 iterations took 4.5 s on the dev PC with
// `node --jitless`. A 4-digit PIN gains nothing from cost (10 000 values); its protection is the
// Keystore and the attempt limit. The password cost is the most that keeps a rare unlock near
// 2 s. [ASSUMPTION] Calibrate both on the S24 Ultra; the cost is stored per verifier.
export const PIN_ITERATIONS = 1_000;
export const PASSWORD_ITERATIONS = 10_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

export async function createVerifier(
  secret: string,
  iterations: number,
  randomBytes: (length: number) => Uint8Array,
): Promise<Verifier> {
  const salt = toHex(randomBytes(SALT_BYTES));
  const hash = await derive(secret, { salt, iterations });
  return { v: 1, iterations, salt, hash };
}

export async function verifySecret(secret: string, verifier: Verifier): Promise<boolean> {
  const hash = await derive(secret, verifier);
  let difference = hash.length ^ verifier.hash.length;
  for (let index = 0; index < hash.length; index += 1) {
    difference |= hash.charCodeAt(index) ^ verifier.hash.charCodeAt(index);
  }
  return difference === 0;
}

async function derive(secret: string, cost: { salt: string; iterations: number }): Promise<string> {
  const salt = Uint8Array.from(cost.salt.match(/.{2}/g) ?? [], (hex) => Number.parseInt(hex, 16));
  return toHex(await pbkdf2Async(sha256, secret, salt, { c: cost.iterations, dkLen: HASH_BYTES }));
}
