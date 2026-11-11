import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";

/** Where the clips live: `web/public/tutorials/<module>/<tutorial>/<step>.webm` plus `.webp`. */
export const CLIPS_ROOT = path.resolve(import.meta.dirname, "../../../public/tutorials");

const MAX_SECONDS = 15;

export interface ClipId {
  module: string;
  tutorial: string;
  step: string;
}

export interface EncodedClip {
  video: string;
  poster: string;
  bytes: number;
}

const VIDEO_ARGS = [
  "-t",
  String(MAX_SECONDS),
  "-an",
  "-vf",
  "scale=1280:-2",
  "-c:v",
  "libvpx-vp9",
  "-crf",
  "40",
  "-b:v",
  "0",
  "-row-mt",
  "1",
];
const POSTER_ARGS = ["-frames:v", "1", "-vf", "scale=960:-2", "-quality", "70"];

function ffmpeg(args: string[]): void {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
}

/**
 * Cuts the raw recording (VP8, big) from where the action starts into a small VP9 clip of at most
 * 15 s, 1280 px wide, no audio, and takes the poster from near its end (the finished state).
 * Needs `ffmpeg` on PATH.
 */
export function encodeClip(raw: string, id: ClipId, startSeconds: number): EncodedClip {
  const dir = path.join(CLIPS_ROOT, id.module, id.tutorial);
  mkdirSync(dir, { recursive: true });
  const video = path.join(dir, `${id.step}.webm`);
  const poster = path.join(dir, `${id.step}.webp`);
  ffmpeg(["-ss", String(Math.max(0, startSeconds)), "-i", raw, ...VIDEO_ARGS, video]);
  ffmpeg(["-sseof", "-1.5", "-i", video, ...POSTER_ARGS, poster]);
  return { video, poster, bytes: statSync(video).size };
}
