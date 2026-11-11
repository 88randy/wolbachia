import { CalendarCheck, MapPin, RotateCw, Route } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { BigActionCard } from "../../ui/BigActionCard.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { RouteCard } from "./RouteCard.tsx";
import { displayPointCode } from "./point-code.ts";
import { ACTION_KEYS } from "./presentation.ts";
import { RouteProblems } from "./RouteProblems.tsx";
import { RouteProgress } from "./RouteProgress.tsx";
import { useM06 } from "./use-m-06.ts";
import { useStartTask } from "./use-start-task.ts";

/** Mi ruta: where you are in the day, what is next, and every point with how to get there. */
export function P9Screen() {
  const model = useM06();
  const t = useT();
  const { push } = useNavigation();
  const start = useStartTask();
  const next = model.pendingTasks[0];
  const isComplete = model.phase === "complete";
  const failedPoint =
    model.state?.navigation?.outcome && model.state.navigation.outcome !== "launched"
      ? model.state.navigation.pointId
      : null;
  return (
    <ScreenScaffold
      tab="day"
      header={<AppHeader title={t("field.day.title")} />}
      footer={
        isComplete ? (
          <PrimaryButton
            icon={CalendarCheck}
            label={t("field.day.closeShift")}
            onPress={() => {
              push({ name: "closeShift" });
            }}
          />
        ) : undefined
      }
    >
      <RouteProblems model={model} />
      {model.state === null ? (
        model.isLoading ? (
          <Skeleton />
        ) : null
      ) : model.phase === "empty" ? (
        <EmptyState
          icon={MapPin}
          title={t("field.day.empty")}
          message={t("field.day.emptyHint")}
          actionLabel={t("field.action.refresh")}
          actionIcon={RotateCw}
          onAction={() => {
            void model.refresh();
          }}
        />
      ) : (
        <>
          <RouteProgress completed={model.completed} total={model.total} />
          {next === undefined ? null : (
            <BigActionCard
              icon={Route}
              title={t("field.day.point", { code: displayPointCode(next.task.point_code) })}
              body={t(ACTION_KEYS[next.task.action])}
              actionLabel={t("field.day.start")}
              onPress={() => {
                start(next.task);
              }}
            />
          )}
          {model.tasks
            .filter((row) => row.task.id !== next?.task.id)
            .map((row) => (
              <RouteCard
                key={row.task.id}
                row={row}
                isActing={model.isActing}
                navigationFailed={failedPoint === row.task.id}
                onDirections={() => {
                  void model.navigate(row.task);
                }}
                onStart={() => {
                  start(row.task);
                }}
              />
            ))}
        </>
      )}
    </ScreenScaffold>
  );
}
