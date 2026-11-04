import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { SERVICE_FAILURE_KEYS } from "../api/service-failure";
import type { ServiceFailure } from "../api/service-failure";
import { FormAlert } from "./FormAlert";

interface ServiceFailureAlertProps {
  id: string;
  /** Nothing is rendered while there is no failure. */
  failure: ServiceFailure | undefined;
  ref?: Ref<HTMLDivElement>;
}

/** Error summary for a failure that is not about the form's fields (network, server, limits). */
export function ServiceFailureAlert({ id, failure, ref }: ServiceFailureAlertProps) {
  const { t } = useTranslation();
  if (failure === undefined) return null;
  return <FormAlert id={id} ref={ref} title={t(SERVICE_FAILURE_KEYS[failure])} />;
}
