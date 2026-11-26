import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { ClipPlayer } from "./ClipPlayer";
import { clipUrls, stepKey } from "./tutorial-keys";
import { linkEdge, linkTarget } from "./types";
import type { StepLink, Tutorial, TutorialStep } from "./types";
import type { TutorialPlayer } from "./use-tutorial-player";

interface BranchProps {
  tutorial: Tutorial;
  link: StepLink;
  onPick: (id: string) => void;
}

/** One way to continue, named "Yes: Done" or just the step. */
function BranchButton({ tutorial, link, onPick }: BranchProps) {
  const { t } = useTranslation();
  const edge = linkEdge(link);
  const target = linkTarget(link);
  const name = t(stepKey(tutorial.id, target, "label"));
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        onPick(target);
      }}
    >
      {edge ? `${t(`tutorials.edge.${edge}`)}: ${name}` : name}
    </Button>
  );
}

/** The buttons of a question: one per way to continue. */
function BranchChoices({
  tutorial,
  step,
  onPick,
}: {
  tutorial: Tutorial;
  step: TutorialStep;
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t("tutorials.player.pickBranch")}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-sm text-ink-2">{t("tutorials.player.pickBranch")}</span>
      {step.next.map((link) => (
        <BranchButton key={linkTarget(link)} tutorial={tutorial} link={link} onPick={onPick} />
      ))}
    </div>
  );
}

/** The clip of the current step, its caption (from i18n, never baked into the video) and the branches. */
export function StepPanel({ tutorial, player }: { tutorial: Tutorial; player: TutorialPlayer }) {
  const { t } = useTranslation();
  const { step } = player;
  const source = step.clipFrom ?? { module: tutorial.module, tutorial: tutorial.id, step: step.id };
  const urls = clipUrls(source.module, source.tutorial, source.step);
  const hasClip = step.hasClip !== false;
  return (
    <div className="flex flex-col gap-3">
      <ClipPlayer
        video={hasClip ? urls.video : undefined}
        poster={hasClip ? urls.poster : undefined}
        isPlaying={player.isPlaying}
        label={t("tutorials.player.clipLabel", { step: t(stepKey(tutorial.id, step.id, "label")) })}
        onEnded={player.advance}
      />
      <p aria-live="polite" className="m-0 text-base leading-6 font-semibold text-ink">
        {t(stepKey(tutorial.id, step.id, "caption"))}
      </p>
      {player.isEnd && <p className="m-0 text-sm text-ink-2">{t("tutorials.player.finished")}</p>}
      {step.next.length > 1 && (
        <BranchChoices tutorial={tutorial} step={step} onPick={player.select} />
      )}
    </div>
  );
}
