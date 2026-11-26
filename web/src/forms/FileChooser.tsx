import { useRef } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";

interface FileChooserProps {
  id: string;
  accept: string;
  file: File | undefined;
  disabled: boolean | undefined;
  invalid: boolean;
  describedBy: string | undefined;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/** The hidden native input, the button that opens it (its keyboard stop) and the chosen name. */
// eslint-disable-next-line max-lines-per-function -- input, button and name are one control.
export function FileChooser(props: FileChooserProps) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={input}
        id={props.id}
        type="file"
        accept={props.accept}
        className="sr-only"
        tabIndex={-1}
        disabled={props.disabled}
        aria-invalid={props.invalid ? true : undefined}
        aria-describedby={props.describedBy}
        onChange={props.onChange}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={props.disabled}
        aria-describedby={props.describedBy}
        onClick={() => input.current?.click()}
      >
        {t("common.file.choose")}
      </Button>
      <span className="text-sm text-ink-2" aria-live="polite">
        {props.file?.name ?? t("common.file.none")}
      </span>
    </div>
  );
}
