/** Download authored local artifacts without a network client or a persisted API response. */
export function downloadAnnotationFile(file: Blob, filename: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
