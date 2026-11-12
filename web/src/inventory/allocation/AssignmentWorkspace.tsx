import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../ui/EmptyState";
import { ErrorState } from "../../ui/ErrorState";
import { InlineNotice } from "../../ui/InlineNotice";
import { AssignmentPanel } from "./AssignmentPanel";
import { DateField } from "../../ui/DateField";
import { CourierPicker } from "./CourierPicker";
import { ASSIGNMENTS_ROUTE, courierDirectoryOptions } from "./allocation-query";
import type { AllocationScope, CourierEntry } from "./allocation-query";

interface Props {
  scope: AllocationScope;
  date: string;
  onDateChange: (date: string) => void;
  courierId: string;
  canAllocate: boolean;
}

/** Only couriers can receive material; if the list has none, everyone listed is offered. */
function courierChoices(people: CourierEntry[]) {
  const couriers = people.filter((person) => person.profiles.includes("courier"));
  return couriers.length > 0 ? couriers : people;
}

function Layout({ people, ...props }: Props & { people: CourierEntry[] }) {
  const { t } = useTranslation();
  const choices = courierChoices(people);
  const selected = choices.find((person) => person.id === props.courierId);
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="grid max-w-2xl min-w-0 grid-cols-1 items-start gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <CourierPicker couriers={choices} selected={selected?.id ?? ""} date={props.date} />
        <DateField
          id="allocation-date"
          label={t("allocation.filter.date")}
          value={props.date}
          onChange={props.onDateChange}
        />
      </div>
      {selected ? (
        <AssignmentPanel
          key={`${selected.id}|${props.date}`}
          courier={selected}
          scope={props.scope}
          date={props.date}
          canAllocate={props.canAllocate}
        />
      ) : (
        <InlineNotice tone="info">{t("allocation.assignment.pickCourier")}</InlineNotice>
      )}
    </div>
  );
}

/** Courier picker plus the panel of the chosen courier; errors and empty states are explicit. */
export function AssignmentWorkspace(props: Props) {
  const { t } = useTranslation();
  const couriers = useQuery(courierDirectoryOptions(props.scope, ASSIGNMENTS_ROUTE));
  if (couriers.error instanceof ApiError && couriers.error.status === 403)
    return <InlineNotice tone="warning">{t("allocation.assignment.couriersDenied")}</InlineNotice>;
  if (couriers.isError)
    return (
      <ErrorState
        code="network_error"
        message={t("allocation.assignment.couriersError")}
        onRetry={() => void couriers.refetch()}
      />
    );
  if (couriers.data?.length === 0)
    return <EmptyState kind="noData" message={t("allocation.assignment.noCouriers")} />;
  return <Layout people={couriers.data ?? []} {...props} />;
}
