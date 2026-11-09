import type { EvidenceReader, EvidenceWriter, PrivateFiles } from "./owned-files.ts";

/** Awaited native file work is fenced without holding a database or credential lock. */
export function guardPrivateFiles(files: PrivateFiles, check: () => Promise<void>): PrivateFiles {
  return {
    owns: (ref) => files.owns(ref),
    openRead: async (ref) => {
      await check();
      const reader = await files.openRead(ref);
      try {
        await check();
        return guardedReader(reader, check);
      } catch (error) {
        await reader.close();
        throw error;
      }
    },
    createExclusive: async (id) => {
      await check();
      const destination = await files.createExclusive(id);
      try {
        await check();
        return { ref: destination.ref, writer: guardedWriter(destination.writer, check) };
      } catch (error) {
        await destination.writer.close();
        throw error;
      }
    },
  };
}
function guardedReader(reader: EvidenceReader, check: () => Promise<void>): EvidenceReader {
  return {
    read: async (length) => {
      await check();
      const bytes = await reader.read(length);
      await check();
      return bytes;
    },
    close: () => reader.close(),
  };
}
function guardedWriter(writer: EvidenceWriter, check: () => Promise<void>): EvidenceWriter {
  return {
    write: async (bytes) => {
      await check();
      await writer.write(bytes);
      await check();
    },
    close: () => writer.close(),
  };
}
