import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface ClipPlayerProps {
  /** `undefined` for a step with nothing recorded. */
  video: string | undefined;
  poster: string | undefined;
  isPlaying: boolean;
  /** Accessible name of the video, e.g. "Video of the step: Prepare". */
  label: string;
  onEnded: () => void;
}

const FRAME_CLASS =
  "flex aspect-video max-h-[38dvh] w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-muted";

/** Plays or pauses the video element whenever the step or the play state changes. */
function useClipPlayback(isPlaying: boolean, video: string | undefined) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (isPlaying) void element.play().catch(() => undefined);
    else element.pause();
  }, [isPlaying, video]);
  return ref;
}

function ClipFallback() {
  const { t } = useTranslation();
  return (
    <div className={FRAME_CLASS}>
      <p className="m-0 px-6 text-center text-sm text-ink-2">{t("tutorials.player.noClip")}</p>
    </div>
  );
}

/**
 * The clip of one step: muted, no browser controls (ours sit below), no captions baked in.
 * A clip that is missing or fails shows a calm notice instead of a broken player.
 */
export function ClipPlayer({ video, poster, isPlaying, label, onEnded }: ClipPlayerProps) {
  const ref = useClipPlayback(isPlaying, video);
  const [failed, setFailed] = useState<string | undefined>(undefined);
  if (video === undefined || failed === video) return <ClipFallback />;
  return (
    <div className={FRAME_CLASS}>
      <video
        key={video}
        ref={ref}
        muted
        playsInline
        preload="metadata"
        poster={poster}
        aria-label={label}
        className="size-full object-contain"
        onEnded={onEnded}
        onError={() => {
          setFailed(video);
        }}
      >
        <source src={video} type="video/webm" />
      </video>
    </div>
  );
}
