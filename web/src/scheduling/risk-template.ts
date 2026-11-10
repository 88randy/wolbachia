/** CSV with the codes of the given blocks and an empty risk to fill in, ready to download. */
export function riskTemplate(codes: readonly string[]): string {
  return `${["block_code,category,protocol", ...codes.map((code) => `${code},,`)].join("\r\n")}\r\n`;
}

/** Saves text as a file through the browser, without a server round trip. */
export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
