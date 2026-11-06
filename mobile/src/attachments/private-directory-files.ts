import { EvidenceError, EVIDENCE_UUID } from "./types.ts";
import type { PrivateFiles } from "./owned-files.ts";

interface PrivateDirectory {
  readonly uri: string;
  readonly prepare: () => void;
  readonly createExclusive: PrivateFiles["createExclusive"];
}

/** Declaring the port does no photo I/O; directory failures belong to the capture attempt. */
export function privateDirectoryFiles(input: {
  readonly directory: () => PrivateDirectory;
  readonly openRead: PrivateFiles["openRead"];
}): PrivateFiles {
  return {
    owns: (ref) => isOwnedRef(input.directory().uri, ref),
    openRead: input.openRead,
    createExclusive: async (id) => {
      if (!EVIDENCE_UUID.test(id)) throw new EvidenceError("file_identity");
      const directory = input.directory();
      directory.prepare();
      return directory.createExclusive(id);
    },
  };
}

function isOwnedRef(uri: string, ref: string): boolean {
  const prefix = `${uri.replace(/\/$/, "")}/`;
  return ref.startsWith(prefix) && EVIDENCE_UUID.test(ref.slice(prefix.length));
}
