import { useRouter, useRouterState } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMe } from "../session/use-me";
import { Button } from "../ui/Button";
import { useIsFinished } from "./tutorial-progress";
import { TUTORIAL_ROUTES } from "./tutorial-routes";
import type { TutorialId } from "./tutorial-routes";

/** The modal, its diagram and the clips are a separate chunk: loaded when the user asks for them. */
const loadModal = () => import("./TutorialModal");
const TutorialModal = lazy(loadModal);

/** The "Nuevo" dot, for a tutorial this user has not finished. Dot plus hidden text. */
function NewDot() {
  const { t } = useTranslation();
  return (
    <span className="ml-1 inline-flex items-center">
      <span aria-hidden="true" className="size-2 rounded-full bg-action" />
      <span className="sr-only">{t("tutorials.button.new")}</span>
    </span>
  );
}

function HowToTrigger({ tutorialId }: { tutorialId: TutorialId }) {
  const { t } = useTranslation();
  const userId = useMe().user.id;
  const [isOpen, setIsOpen] = useState(false);
  const isFinished = useIsFinished(userId, tutorialId);
  const close = () => {
    setIsOpen(false);
  };
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-haspopup="dialog"
        leadingIcon={<CircleHelp aria-hidden="true" />}
        onPointerEnter={() => void loadModal()}
        onFocus={() => void loadModal()}
        onClick={() => {
          setIsOpen(true);
        }}
      >
        {t("tutorials.button.label")}
        {!isFinished && <NewDot />}
      </Button>
      <Suspense fallback={null}>
        {isOpen && <TutorialModal tutorialId={tutorialId} userId={userId} onClose={close} />}
      </Suspense>
    </>
  );
}

function RouteHowTo() {
  const fullPath = useRouterState({ select: (state) => state.matches.at(-1)?.fullPath });
  const tutorialId = fullPath ? TUTORIAL_ROUTES[fullPath] : undefined;
  return tutorialId ? <HowToTrigger tutorialId={tutorialId} /> : null;
}

/**
 * The "How does it work?" button of a page header. Without `screen` it finds the tutorial of
 * the current route (`tutorial-routes.ts`) and renders nothing when the route has none.
 */
export function HowToButton({ screen }: { screen?: TutorialId }) {
  const router: unknown = useRouter({ warn: false });
  if (screen) return <HowToTrigger tutorialId={screen} />;
  return router ? <RouteHowTo /> : null;
}
