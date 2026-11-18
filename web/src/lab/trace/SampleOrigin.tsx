import { EmptyValue } from "../../ui/EmptyValue";
import { BagCodeLink } from "./BagCodeLink";

interface Props {
  /** Code of the bag the sample came from; only samples taken from a reading have one. */
  bagCode: string | null | undefined;
  /** What to say when the sample did not come from a bag (a lot or a release), already translated. */
  otherOrigin: string;
}

/** Where a Wolbachia sample comes from: a bag opens its full origin, a lot or release is plain text. */
export function SampleOrigin({ bagCode, otherOrigin }: Props) {
  if (bagCode)
    return (
      // A row may toggle on click (the PCR wizard): opening the origin must not toggle it.
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- only stops propagation; the real control inside is a button.
      <span
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <BagCodeLink code={bagCode} />
      </span>
    );
  return otherOrigin === "" ? <EmptyValue /> : <span>{otherOrigin}</span>;
}
