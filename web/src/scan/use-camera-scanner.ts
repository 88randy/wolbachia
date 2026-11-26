import { useCallback, useEffect, useRef, useState } from "react";
import { classifyCameraError, openCamera, setTorch, stopStream, supportsTorch } from "./camera";
import type { CameraFailure } from "./camera";
import type { Decoder } from "./decoder-types";

export type CameraStatus = "starting" | "scanning" | CameraFailure;

/** Time between two frame reads: fast enough to feel instant, light enough for a tablet. */
const FRAME_INTERVAL_MS = 180;
/** `HAVE_CURRENT_DATA`: the video has a frame to read. */
const HAVE_FRAME = 2;

async function loadDecoder(): Promise<Decoder> {
  const module = await import("./decoder");
  return module.loadDecoder();
}

interface Session {
  isActive: boolean;
  stream: MediaStream | null;
  timer: number | undefined;
}

function startLoop(
  session: Session,
  video: HTMLVideoElement,
  decoder: Decoder,
  done: (code: string) => void,
) {
  const tick = async () => {
    if (!session.isActive) return;
    const code =
      video.readyState >= HAVE_FRAME ? await decoder.read(video).catch(() => null) : null;
    if (!session.isActive) return;
    if (code === null || code === "") {
      session.timer = window.setTimeout(() => void tick(), FRAME_INTERVAL_MS);
      return;
    }
    session.isActive = false;
    stopStream(session.stream);
    done(code);
  };
  void tick();
}

/** Opens the camera, reads codes from it until one is found, and releases the camera on close. */
export function useCameraScanner(onCode: (code: string) => void, attempt: number) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | undefined>(undefined);
  const onCodeRef = useRef(onCode);
  const [status, setStatus] = useState<CameraStatus>("starting");
  const [canTorch, setCanTorch] = useState(false);
  const [isTorchOn, setTorchOn] = useState(false);

  useEffect(() => {
    onCodeRef.current = onCode;
  });

  useEffect(() => {
    const session: Session = { isActive: true, stream: null, timer: undefined };
    const run = async () => {
      setStatus("starting");
      try {
        session.stream = await openCamera();
        if (!session.isActive) {
          stopStream(session.stream);
          return;
        }
        const track = session.stream.getVideoTracks()[0];
        trackRef.current = track;
        setCanTorch(supportsTorch(track));
        const video = videoRef.current;
        if (video === null) {
          stopStream(session.stream);
          return;
        }
        video.srcObject = session.stream;
        await video.play().catch(() => undefined);
        const decoder = await loadDecoder();
        if (!session.isActive) {
          stopStream(session.stream);
          return;
        }
        setStatus("scanning");
        startLoop(session, video, decoder, (code) => {
          onCodeRef.current(code);
        });
      } catch (error) {
        stopStream(session.stream);
        if (session.isActive) setStatus(classifyCameraError(error));
      }
    };
    void run();
    return () => {
      session.isActive = false;
      window.clearTimeout(session.timer);
      stopStream(session.stream);
    };
  }, [attempt]);

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (track === undefined) return;
    const next = !isTorchOn;
    await setTorch(track, next).then(
      () => {
        setTorchOn(next);
      },
      () => {
        setCanTorch(false);
      },
    );
  }, [isTorchOn]);

  return { videoRef, status, canTorch, isTorchOn, toggleTorch };
}
