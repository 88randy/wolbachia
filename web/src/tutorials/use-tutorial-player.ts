import { useCallback, useEffect, useMemo, useState } from "react";
import { linkTarget } from "./types";
import type { Tutorial, TutorialStep } from "./types";

/** How long a step without a clip stays on screen while playing (ms). */
const NO_CLIP_DWELL_MS = 3500;

export interface TutorialPlayer {
  step: TutorialStep;
  index: number;
  visited: ReadonlySet<string>;
  isPlaying: boolean;
  isEnd: boolean;
  /** Where the flow goes from here; more than one means a question. */
  choices: readonly string[];
  select: (id: string) => void;
  next: () => void;
  previous: () => void;
  togglePlay: () => void;
  /** Back to the first step, playing. */
  restart: () => void;
  /** A clip ended: go on when there is exactly one way, else wait for the user's choice. */
  advance: () => void;
}

interface Cursor {
  tutorial: Tutorial;
  step: TutorialStep;
  select: (id: string) => void;
}

/** The current step and the steps already seen. */
function useStepCursor(tutorial: Tutorial) {
  const first = tutorial.steps[0];
  if (!first) throw new Error(`Tutorial "${tutorial.id}" has no steps`);
  const [currentId, setCurrentId] = useState(first.id);
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set([first.id]));
  const select = useCallback((id: string) => {
    setCurrentId(id);
    setVisited((seen) => new Set(seen).add(id));
  }, []);
  const index = Math.max(
    0,
    tutorial.steps.findIndex((step) => step.id === currentId),
  );
  return { step: tutorial.steps[index] ?? first, index, visited, select };
}

/** A step without a clip stays a moment while playing, then the flow moves on. */
function useDwell(isPlaying: boolean, step: TutorialStep, advance: () => void) {
  useEffect(() => {
    if (!isPlaying || step.hasClip !== false) return;
    const timer = window.setTimeout(advance, NO_CLIP_DWELL_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isPlaying, step, advance]);
}

/** Moving around the flow: next, previous, play/pause and what to do when a clip ends. */
function useNavigation({ tutorial, step, select }: Cursor, autoplay: boolean) {
  const choices = useMemo(() => step.next.map(linkTarget), [step]);
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const next = useCallback(() => {
    if (choices[0]) select(choices[0]);
  }, [choices, select]);
  const previous = useCallback(() => {
    const before = tutorial.steps.find((candidate) =>
      candidate.next.some((link) => linkTarget(link) === step.id),
    );
    if (before) select(before.id);
  }, [tutorial, step, select]);
  const advance = useCallback(() => {
    if (choices.length === 1 && choices[0]) select(choices[0]);
    else setIsPlaying(false);
  }, [choices, select]);
  const togglePlay = useCallback(() => {
    setIsPlaying((playing) => !playing);
  }, []);
  const restart = useCallback(() => {
    const first = tutorial.steps[0];
    if (first) select(first.id);
    setIsPlaying(true);
  }, [tutorial, select]);
  return { choices, isPlaying, next, previous, advance, togglePlay, restart };
}

/** State of the tutorial modal: current step, visited steps and play/pause. No DOM here. */
export function useTutorialPlayer(
  tutorial: Tutorial,
  options: { autoplay: boolean; onFinished: () => void },
): TutorialPlayer {
  const { step, index, visited, select } = useStepCursor(tutorial);
  const nav = useNavigation({ tutorial, step, select }, options.autoplay);
  const isEnd = nav.choices.length === 0;
  const { onFinished } = options;
  useEffect(() => {
    if (isEnd) onFinished();
  }, [isEnd, onFinished]);
  useDwell(nav.isPlaying, step, nav.advance);
  return { ...nav, step, index, visited, isEnd, select };
}
