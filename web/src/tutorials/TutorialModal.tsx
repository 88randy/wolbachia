import * as Primitive from "@radix-ui/react-dialog";
import { useReducedMotion } from "motion/react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DialogHeader } from "../ui/DialogHeader";
import { DIALOG_DESCRIPTION_CLASS, OVERLAY_CLASS } from "../ui/overlay-classes";
import { TUTORIALS } from "./definitions";
import { FlowDiagram } from "./FlowDiagram";
import { PlayerControls } from "./PlayerControls";
import { StepList } from "./StepList";
import { StepPanel } from "./StepPanel";
import { titleKey } from "./tutorial-keys";
import { markFinished } from "./tutorial-progress";
import type { TutorialId } from "./tutorial-routes";
import type { Tutorial } from "./types";
import { useTutorialPlayer } from "./use-tutorial-player";
import type { TutorialPlayer } from "./use-tutorial-player";

const MODAL_CLASS =
  "fixed top-1/2 left-1/2 z-[81] flex max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),64rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-auto rounded-2xl border border-line bg-popover p-6 text-ink shadow-overlay outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none";

interface BodyProps {
  tutorial: Tutorial;
  player: TutorialPlayer;
}

/** Diagram, clip with caption, and the controls. */
function PlayerSide({ tutorial, player }: BodyProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FlowDiagram
        tutorial={tutorial}
        currentId={player.step.id}
        visited={player.visited}
        onSelect={player.select}
      />
      <StepPanel tutorial={tutorial} player={player} />
      <PlayerControls
        isPlaying={player.isPlaying}
        isFirst={player.index === 0}
        isEnd={player.isEnd}
        index={player.index}
        total={tutorial.steps.length}
        onTogglePlay={player.togglePlay}
        onPrevious={player.previous}
        onNext={player.next}
        onReplay={player.restart}
      />
    </div>
  );
}

interface TutorialModalProps {
  tutorialId: TutorialId;
  userId: string;
  onClose: () => void;
  /** Puts focus back on the button that opened the modal. */
  returnFocus: () => void;
}

/** Player state; reaching the end of a flow marks the tutorial as finished for this user. */
function useModalPlayer(tutorialId: TutorialId, userId: string) {
  const onFinished = useCallback(() => {
    markFinished(userId, tutorialId);
  }, [userId, tutorialId]);
  const autoplay = !(useReducedMotion() ?? false);
  return useTutorialPlayer(TUTORIALS[tutorialId], { autoplay, onFinished });
}

/** Title, step list and player. */
function ModalContent({ tutorialId, userId, returnFocus }: Omit<TutorialModalProps, "onClose">) {
  const { t } = useTranslation();
  const tutorial = TUTORIALS[tutorialId];
  const player = useModalPlayer(tutorialId, userId);
  return (
    <Primitive.Content
      className={MODAL_CLASS}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        returnFocus();
      }}
    >
      <DialogHeader title={t("tutorials.modal.title", { title: t(titleKey(tutorialId)) })} />
      <Primitive.Description className={DIALOG_DESCRIPTION_CLASS}>
        {t("tutorials.modal.description")}
      </Primitive.Description>
      <div className="grid min-w-0 gap-5 md:grid-cols-[14rem_minmax(0,1fr)]">
        <StepList
          tutorial={tutorial}
          currentId={player.step.id}
          visited={player.visited}
          onSelect={player.select}
        />
        <PlayerSide tutorial={tutorial} player={player} />
      </div>
    </Primitive.Content>
  );
}

/** The how-to modal (a Radix dialog: focus trap, Esc, focus back to the button). Lazy-loaded. */
export default function TutorialModal({ onClose, ...content }: TutorialModalProps) {
  return (
    <Primitive.Root
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Primitive.Portal>
        <Primitive.Overlay className={OVERLAY_CLASS} />
        <ModalContent {...content} />
      </Primitive.Portal>
    </Primitive.Root>
  );
}
