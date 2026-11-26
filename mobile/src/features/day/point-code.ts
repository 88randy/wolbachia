/** Assignments name a task "POINT:action:date"; people only ever see the point code. */
export function displayPointCode(code: string): string {
  return code.split(":")[0] ?? code;
}
