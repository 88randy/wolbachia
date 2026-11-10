import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import styles from "../inventory.module.css";

/** Courier choice lives in the address bar, so a view can be shared and the back button works. */
export function CourierList({
  couriers,
  selected,
  date,
}: {
  couriers: readonly Schemas["OperationalPersonnel"][];
  selected: string;
  date: string;
}) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("allocation.assignment.couriers")}>
      <ul className={styles.list}>
        {couriers.map((person) => (
          <li key={person.id}>
            <Link
              to="/inventory/assignments"
              search={{ date, courier: person.id }}
              aria-current={person.id === selected ? "true" : undefined}
            >
              {person.display_name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
