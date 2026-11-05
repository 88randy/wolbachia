import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import type { GeographyScope } from "./use-w-15";
import { useFourPoints, POINTS_PER_BLOCK } from "./use-four-points";
import { FourPointInputs } from "./FourPointInputs";
import { FourPointFeedback } from "./FourPointFeedback";
import { CreateActions } from "./CreateActions";
import { useRetryWindow } from "./use-retry-window";
interface Props {
  scope: GeographyScope;
  block: Schemas["Block"];
  locations: number[][];
}
export function FourPointForm({ scope, block, locations }: Props) {
  const { t } = useTranslation();
  const form = useFourPoints({ scope, block: block.id, locations });
  const isWaiting = useRetryWindow(form.write.retryAt);
  const actions = {
    label: "geography.points.four" as const,
    isDisabled:
      !form.isValid ||
      form.isRunning ||
      isWaiting ||
      Boolean(form.reconciliation.uncertain) ||
      form.created.length === POINTS_PER_BLOCK,
    isBusy: form.isRunning,
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.create();
      }}
    >
      <h3>{t("geography.points.four")}</h3>
      <p>{t("geography.points.fixed")}</p>
      <FourPointInputs form={form} />
      <CreateActions {...actions} />
      <FourPointFeedback {...{ scope, block, form }} />
    </form>
  );
}
