import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FieldNotes } from "../forms/FieldNotes";
import { classNames } from "../styles/class-names";
import styles from "./void-dialog.module.css";
import type { VoidForm } from "./use-void-form";

type FieldState = Pick<
  VoidForm,
  "reason" | "setReason" | "count" | "minLength" | "maxLength" | "hasTooShortError"
>;

/** Puts focus on the returned ref's element when `condition` becomes true. */
function useFocusWhen(condition: boolean) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (condition) ref.current?.focus();
  }, [condition]);
  return ref;
}

function describedBy(id: string, hasError: boolean): string {
  return [`${id}-hint`, `${id}-counter`, hasError && `${id}-error`].filter(Boolean).join(" ");
}

function Counter({
  id,
  count,
  min,
  max,
}: { id: string } & Record<"count" | "min" | "max", number>) {
  const { t } = useTranslation();
  const key = count < min ? "voiding.dialog.counterBelow" : "voiding.dialog.counterOk";
  return (
    <p id={`${id}-counter`} className={styles.counter}>
      {t(key, { count, min, max })}
    </p>
  );
}

function ReasonLabel({ htmlFor }: { htmlFor: string }) {
  const { t } = useTranslation();
  return (
    <label htmlFor={htmlFor} className={styles.label}>
      {t("common.fields.voidReason")}{" "}
      <span className={styles.required}>({t("voiding.dialog.required")})</span>
    </label>
  );
}

/**
 * Label, textarea, the minimum and a counter. The counter is read when the field gets focus (it is
 * part of its description) and not on every key, which would drown a screen reader. A too-short
 * reason puts focus back here, so the error is read together with the field.
 */
export function VoidReasonField(props: FieldState) {
  const { reason, setReason, count, minLength, maxLength, hasTooShortError } = props;
  const { t } = useTranslation();
  const id = useId();
  const input = useFocusWhen(hasTooShortError);
  const error = hasTooShortError ? t("voiding.error.tooShort", { min: minLength }) : undefined;
  return (
    <div className={styles.field}>
      <ReasonLabel htmlFor={id} />
      <textarea
        ref={input}
        id={id}
        className={classNames(styles.textarea, hasTooShortError && styles.invalid)}
        value={reason}
        rows={4}
        maxLength={maxLength}
        required
        aria-invalid={hasTooShortError ? true : undefined}
        aria-describedby={describedBy(id, hasTooShortError)}
        onChange={(event) => {
          setReason(event.target.value);
        }}
      />
      <FieldNotes id={id} hint={t("voiding.dialog.minHelp", { min: minLength })} error={error} />
      <Counter id={id} count={count} min={minLength} max={maxLength} />
    </div>
  );
}
