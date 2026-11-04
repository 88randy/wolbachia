import styles from "./voided.module.css";

/**
 * Class for the `<tr>` (or list item) of a voided record: muted text. Combine it with
 * `classNames(voidedRowClass, ...)`; the strike and the badge come from `VoidedCell`.
 */
export const voidedRowClass: string | undefined = styles.row;
