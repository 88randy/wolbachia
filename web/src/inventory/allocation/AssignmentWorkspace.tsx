import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { EmptyState } from "../../ui/EmptyState";
import { ErrorState } from "../../ui/ErrorState";
import { InlineNotice } from "../../ui/InlineNotice";
import { AssignmentPanel } from "./AssignmentPanel";
import { CourierList } from "./CourierList";
import { ASSIGNMENTS_ROUTE, courierDirectoryOptions } from "./allocation-query";
import type { AllocationScope } from "./allocation-query";
import styles from "../inventory.module.css";

interface Props {
  scope: AllocationScope;
  date: string;
  courierId: string;
  canAllocate: boolean;
}

function Layout({ people, ...props }: Props & { people: Schemas["OperationalPersonnel"][] }) {
  const { t } = useTranslation();
  const selected = people.find((person) => person.id === props.courierId);
  return (
    <div className={styles.split}>
      <CourierList couriers={people} selected={selected?.id ?? ""} date={props.date} />
      {selected ? (
        <AssignmentPanel key={`${selected.id}|${props.date}`} courier={selected} {...props} />
      ) : (
        <InlineNotice tone="info">{t("allocation.assignment.pickCourier")}</InlineNotice>
      )}
    </div>
  );
}

/** Courier list plus the panel of the chosen courier; errors and empty states are explicit. */
export function AssignmentWorkspace(props: Props) {
  const { t } = useTranslation();
  const couriers = useQuery(courierDirectoryOptions(props.scope, ASSIGNMENTS_ROUTE));
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
