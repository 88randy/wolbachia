/** Reads one frame of a playing video and returns the text of the first code found, or null. */
export interface Decoder {
  read: (video: HTMLVideoElement) => Promise<string | null>;
}
