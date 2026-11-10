import { Search } from "lucide-react";
import styles from "./filter-bar.module.css";
import type { TextFilter } from "./table-types";

interface FilterTextInputProps {
  id: string;
  filter: TextFilter;
  value: string | undefined;
}

/** Uncontrolled: the value is read from the form on submit, so typing makes no request. */
export function FilterTextInput({ id, filter, value }: FilterTextInputProps) {
  return (
    <span className="relative inline-flex min-w-0 flex-1">
      <Search
        aria-hidden="true"
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
      />
      <input
        id={id}
        name={filter.key}
        type="text"
        inputMode={filter.format === "positive-integer" ? "numeric" : undefined}
        pattern={filter.format === "positive-integer" ? "[1-9][0-9]*" : undefined}
        className={`${styles.control ?? ""} w-full! min-w-56 pl-9!`}
        defaultValue={value ?? ""}
        maxLength={filter.maxLength}
        autoComplete="off"
      />
    </span>
  );
}
