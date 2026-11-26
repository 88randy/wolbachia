import { readFileSync } from "node:fs";

/**
 * Demo credentials live in a local file that is never committed. Point `TUTORIALS_CREDENTIALS_FILE`
 * at it. The row of a user looks like `| demo-warehouse | role | <password> |`. Nothing here prints
 * a password.
 */
export interface Credentials {
  username: string;
  password: string;
}

function cellsOf(line: string): string[] {
  return line
    .split("|")
    .map((cell) => cell.replaceAll("`", "").trim())
    .filter((cell) => cell !== "");
}

export function credentialsFor(username: string): Credentials {
  const file = process.env["TUTORIALS_CREDENTIALS_FILE"];
  if (!file) throw new Error("Set TUTORIALS_CREDENTIALS_FILE to the demo credentials file.");
  const line = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((candidate) => cellsOf(candidate)[0] === username);
  const password = line ? cellsOf(line)[2] : undefined;
  if (!password) throw new Error(`No credentials row for "${username}" in the file.`);
  return { username, password };
}
