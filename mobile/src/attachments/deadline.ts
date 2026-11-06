import { EvidenceError } from "./types.ts";

/** Ends this file turn without cancelling the shared auth refresh used by unrelated work. */
export function withinDeadline<Result>(
  signal: AbortSignal,
  operation: () => Promise<Result>,
): Promise<Result> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new EvidenceError("upload_timeout"));
      return;
    }
    const expire = () => {
      reject(new EvidenceError("upload_timeout"));
    };
    signal.addEventListener("abort", expire, { once: true });
    void operation().then(
      (value) => {
        signal.removeEventListener("abort", expire);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", expire);
        reject(error instanceof Error ? error : new EvidenceError("upload_retry"));
      },
    );
  });
}
