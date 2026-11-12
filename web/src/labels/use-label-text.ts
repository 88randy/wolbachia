import { useTranslation } from "react-i18next";
import { useFormatCalendarDate, useFormatDate } from "../format/use-formatters";
import type { LabelText } from "./label-records";

/** The translator and formatters label mappers need, in the user's language and time zone. */
export function useLabelText(): LabelText {
  const { t } = useTranslation();
  return {
    t: (key, params) => t(key, params),
    calendarDate: useFormatCalendarDate(),
    date: useFormatDate(),
  };
}
