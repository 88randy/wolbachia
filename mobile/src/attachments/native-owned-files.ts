import { Directory, File, FileMode, Paths } from "expo-file-system";
import { EvidenceError } from "./types.ts";
import type { EvidenceReader, EvidenceWriter, PrivateFiles } from "./owned-files.ts";
import { privateDirectoryFiles } from "./private-directory-files.ts";

/** SDK 58.0.13 handles are awaited in order; originals never live in cache/shared storage. */
export function nativeOwnedFiles(): PrivateFiles {
  return privateDirectoryFiles({
    directory: () => {
      const directory = new Directory(Paths.document, "private-evidence");
      return {
        uri: directory.uri,
        prepare: () => {
          directory.create({ intermediates: true, idempotent: true });
        },
        createExclusive: (id) => createNativeExclusive(directory, id),
      };
    },
    openRead: openNativeRead,
  });
}
function openNativeRead(ref: string): Promise<EvidenceReader> {
  if (!/^(file|content):\/\//.test(ref)) return Promise.reject(new EvidenceError("file_private"));
  const handle = new File(ref).open(FileMode.ReadOnly);
  return Promise.resolve({
    read: (size) => handle.readBytes(size),
    close: () => {
      handle.close();
    },
  });
}
function createNativeExclusive(
  directory: Directory,
  id: string,
): Promise<{ ref: string; writer: EvidenceWriter }> {
  const file = new File(directory, id);
  file.create({ overwrite: false });
  const handle = file.open(FileMode.WriteOnly);
  return Promise.resolve({
    ref: file.uri,
    writer: {
      write: (bytes) => handle.writeBytes(bytes),
      close: () => {
        handle.close();
      },
    },
  });
}
