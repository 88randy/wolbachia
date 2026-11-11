import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { MessageKey } from "@wolbachia/i18n";

interface PlayerControlsProps {
  isPlaying: boolean;
  isFirst: boolean;
  isEnd: boolean;
  /** "Paso 2 de 9" */
  index: number;
  total: number;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onReplay: () => void;
}

interface ControlProps {
  icon: ComponentType<{ "aria-hidden": "true" }>;
  labelKey: MessageKey;
  variant: "primary" | "secondary" | "tertiary";
  isDisabled?: boolean;
  onClick: () => void;
}

/** A small button with an icon and a translated name. */
function Control({ icon: Icon, labelKey, variant, isDisabled, onClick }: ControlProps) {
  const { t } = useTranslation();
  return (
    <Button
      variant={variant}
      size="sm"
      disabled={isDisabled}
      onClick={onClick}
      leadingIcon={<Icon aria-hidden="true" />}
    >
      {t(labelKey)}
    </Button>
  );
}

/** Play or pause; at the end of the flow it becomes "watch again". */
function MainControl({ isPlaying, isEnd, onTogglePlay, onReplay }: PlayerControlsProps) {
  if (isEnd) {
    return (
      <Control
        icon={RotateCcw}
        labelKey="tutorials.player.replay"
        variant="secondary"
        onClick={onReplay}
      />
    );
  }
  return (
    <Control
      icon={isPlaying ? Pause : Play}
      labelKey={isPlaying ? "tutorials.player.pause" : "tutorials.player.play"}
      variant="primary"
      onClick={onTogglePlay}
    />
  );
}

/** Previous, play/pause, next, and the position. All real buttons with names. */
export function PlayerControls(props: PlayerControlsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Control
        icon={ChevronLeft}
        labelKey="tutorials.player.previous"
        variant="tertiary"
        isDisabled={props.isFirst}
        onClick={props.onPrevious}
      />
      <MainControl {...props} />
      <Control
        icon={ChevronRight}
        labelKey="tutorials.player.next"
        variant="tertiary"
        isDisabled={props.isEnd}
        onClick={props.onNext}
      />
      <span className="ml-auto text-xs text-ink-2">
        {t("tutorials.player.stepOf", { current: props.index + 1, total: props.total })}
      </span>
    </div>
  );
}
