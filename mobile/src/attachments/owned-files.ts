import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { EvidenceError, FILE_CHUNK_BYTES, MAX_EVIDENCE_BYTES } from "./types.ts";
import type { OwnedEvidence } from "./types.ts";

export interface EvidenceReader {
  read(length: number): Promise<Uint8Array>;
  close(): void | Promise<void>;
}
export interface EvidenceWriter {
  write(bytes: Uint8Array): Promise<void>;
  close(): void | Promise<void>;
}
export interface PrivateFiles {
  owns(ref: string): boolean;
  openRead(ref: string): Promise<EvidenceReader>;
  createExclusive(id: string): Promise<{ ref: string; writer: EvidenceWriter }>;
}
function mimeOf(header: Uint8Array): OwnedEvidence["contentType"] {
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => header[index] === value))
    return "image/png";
  throw new EvidenceError("file_type");
}
async function copyBytes(reader: EvidenceReader, writer: EvidenceWriter) {
  const hash = sha256.create();
  let size = 0;
  let header = new Uint8Array();
  for (;;) {
    const chunk = await reader.read(Math.min(FILE_CHUNK_BYTES, MAX_EVIDENCE_BYTES - size + 1));
    if (!chunk.length) break;
    if (header.length < 8)
      header = Uint8Array.from([...header, ...chunk.slice(0, 8 - header.length)]);
    size += chunk.length;
    if (size > MAX_EVIDENCE_BYTES) throw new EvidenceError("file_size");
    hash.update(chunk);
    await writer.write(chunk);
  }
  return { contentType: mimeOf(header), sizeBytes: size, sha256: bytesToHex(hash.digest()) };
}
/** Keeps possibly referenced files even if later DB acknowledgement is ambiguous. */
export async function copyOwned(input: {
  files: PrivateFiles;
  id: string;
  source: string;
}): Promise<OwnedEvidence> {
  const reader = await input.files.openRead(input.source);
  try {
    return await copyDestination({ ...input, reader });
  } finally {
    await reader.close();
  }
}
async function copyDestination(input: {
  files: PrivateFiles;
  id: string;
  reader: EvidenceReader;
}): Promise<OwnedEvidence> {
  const { ref, writer } = await input.files.createExclusive(input.id);
  try {
    return { id: input.id, fileRef: ref, ...(await copyBytes(input.reader, writer)) };
  } finally {
    await writer.close();
  }
}
/** The returned bounded buffer is exactly the one passed to the transport. */
export async function readVerified(files: PrivateFiles, file: OwnedEvidence): Promise<Uint8Array> {
  if (!files.owns(file.fileRef)) throw new EvidenceError("file_private");
  if (file.sizeBytes <= 0 || file.sizeBytes > MAX_EVIDENCE_BYTES)
    throw new EvidenceError("file_size");
  const reader = await files.openRead(file.fileRef);
  try {
    const bytes = await readComplete(reader, file.sizeBytes);
    if (
      (await reader.read(1)).length ||
      bytesToHex(sha256(bytes)) !== file.sha256 ||
      mimeOf(bytes) !== file.contentType
    )
      throw new EvidenceError("file_changed");
    return bytes;
  } finally {
    await reader.close();
  }
}
async function readComplete(reader: EvidenceReader, size: number): Promise<Uint8Array> {
  const bytes = new Uint8Array(size);
  let offset = 0;
  while (offset < bytes.length) {
    const chunk = await reader.read(Math.min(FILE_CHUNK_BYTES, bytes.length - offset));
    if (!chunk.length) throw new EvidenceError("file_changed");
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
