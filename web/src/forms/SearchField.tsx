import type { ComponentPropsWithoutRef } from "react";
import { Search } from "lucide-react";
import styles from "./form.module.css";
interface SearchFieldProps extends Omit<ComponentPropsWithoutRef<"input">, "id" | "className"> {
  id: string;
  label: string;
}
export function SearchField({ id, label, ...props }: SearchFieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.search}>
        <Search aria-hidden="true" strokeWidth={1.5} className={styles.icon} />
        <input {...props} id={id} type="search" className={styles.input} />
      </div>
    </div>
  );
}
