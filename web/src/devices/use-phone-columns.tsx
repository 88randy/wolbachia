import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../data-table/table-types";
import { useFormatDateTime } from "../format/use-format-date-time";
import { PhoneStatusBadge } from "./PhoneStatusBadge";
import type { Phone } from "./phones-query";

/**
 * Columns of the phones table, in the order of the design (person, phone, version, last seen)
 * plus the status the filter acts on. Names the API gives (username, label) are data, shown as
 * they are; the dates are in the organization's time zone.
 */
export function usePhoneColumns(): readonly DataTableColumn<Phone>[] {
  const { t } = useTranslation();
  const formatDateTime = useFormatDateTime();
  return useMemo(
    () => [
      {
        id: "person",
        headerKey: "phones.column.person",
        cell: (phone) => phone.last_user_username ?? t("phones.cell.noPerson"),
      },
      { id: "phone", headerKey: "phones.column.phone", cell: (phone) => phone.label },
      { id: "version", headerKey: "phones.column.version", cell: (phone) => phone.app_version },
      {
        id: "lastSeen",
        headerKey: "phones.column.lastSeen",
        cell: (phone) =>
          phone.last_seen_at === null
            ? t("phones.cell.neverSeen")
            : formatDateTime(phone.last_seen_at),
      },
      {
        id: "status",
        headerKey: "phones.column.status",
        cell: (phone) => <PhoneStatusBadge isRevoked={phone.is_revoked} />,
      },
    ],
    [t, formatDateTime],
  );
}
