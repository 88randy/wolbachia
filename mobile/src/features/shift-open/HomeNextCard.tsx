import { Bike, CircleCheck, Hourglass, PencilLine, Play, Route } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { MessageKey } from "@wolbachia/i18n";

import { useT } from "../../i18n/I18nProvider.tsx";
import { BigActionCard } from "../../ui/BigActionCard.tsx";
import type { HomeNext } from "./home-next.ts";
import type { HomeNextModel } from "./use-home-next.ts";

interface CardCopy {
  readonly icon: LucideIcon;
  readonly title: MessageKey;
  readonly body?: MessageKey;
  readonly action?: MessageKey;
}

const COPY: Readonly<Record<HomeNext, CardCopy>> = {
  loading: { icon: Hourglass, title: "courier.home.loading" },
  openShift: {
    icon: Bike,
    title: "courier.home.openShiftTitle",
    body: "courier.home.openShiftBody",
    action: "courier.home.openShiftAction",
  },
  resume: {
    icon: Play,
    title: "courier.home.resumeTitle",
    body: "courier.home.resumeBody",
    action: "courier.home.resumeAction",
  },
  retry: {
    icon: PencilLine,
    title: "courier.home.retryTitle",
    body: "courier.home.retryBody",
    action: "courier.home.retryAction",
  },
  route: {
    icon: Route,
    title: "courier.home.routeTitle",
    body: "courier.home.routeBody",
    action: "courier.home.routeAction",
  },
  closed: {
    icon: CircleCheck,
    title: "courier.home.closedTitle",
    body: "courier.home.closedBody",
  },
};

/** "Lo que sigue" on Mi día. */
export function HomeNextCard({
  model,
  isBusy,
}: {
  readonly model: HomeNextModel;
  readonly isBusy: boolean;
}) {
  const t = useT();
  const copy = COPY[model.next];
  return (
    <BigActionCard
      icon={copy.icon}
      title={t(copy.title)}
      body={copy.body ? t(copy.body) : undefined}
      actionLabel={copy.action && model.go ? t(copy.action) : undefined}
      onPress={model.go ?? undefined}
      disabled={isBusy}
    />
  );
}
