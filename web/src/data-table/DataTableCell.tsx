import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { classNames } from "../styles/class-names";
import styles from "./data-table.module.css";

interface DataTableCellProps {
  align: "start" | "end";
  /** Makes the content a link: a row link, or the filtered list behind a number. */
  link: LinkProps | undefined;
  isStruck: boolean;
  /** Extra content under the cell's own (the void detail). */
  after: ReactNode;
  children: ReactNode;
}

export function DataTableCell({ align, link, isStruck, after, children }: DataTableCellProps) {
  const content =
    link === undefined ? (
      children
    ) : (
      <Link {...link} className={styles.link}>
        {children}
      </Link>
    );
  return (
    <td className={classNames(styles.cell, align === "end" && styles.end)}>
      <span className={classNames(isStruck && styles.struck)}>{content}</span>
      {after}
    </td>
  );
}
