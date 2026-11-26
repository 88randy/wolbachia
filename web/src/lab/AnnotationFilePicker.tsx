import { useRef, type ReactNode, type ChangeEvent } from "react";
import { Button } from "../ui/Button";

interface Props {
  isBusy: boolean;
  onChoose: (file?: File) => void;
  descriptionId: string;
  inputLabel: string;
  label: string;
  icon: ReactNode;
  capture?: "environment";
}

function useFilePicker(props: Props) {
  const input = useRef<HTMLInputElement>(null);
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    props.onChoose(event.target.files?.[0]);
    event.target.value = "";
  };
  const attributes = {
    ref: input,
    type: "file",
    name: "egg-photo",
    accept: "image/jpeg,image/png,image/webp",
    hidden: true,
    capture: props.capture,
    "aria-label": props.inputLabel,
    disabled: props.isBusy,
    "aria-describedby": props.descriptionId,
    onChange,
  };
  return {
    attributes,
    open: () => {
      input.current?.click();
    },
  };
}

export function AnnotationFilePicker(props: Props) {
  const picker = useFilePicker(props);
  return (
    <>
      <input {...picker.attributes} />
      <Button
        variant="secondary"
        leadingIcon={props.icon}
        aria-disabled={props.isBusy}
        aria-describedby={props.descriptionId}
        onClick={picker.open}
      >
        {props.label}
      </Button>
    </>
  );
}
