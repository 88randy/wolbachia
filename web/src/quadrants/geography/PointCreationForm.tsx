import { PointInputFields } from "./PointInputFields";
import { CreateActions } from "./CreateActions";
import { WriteNotice } from "./WriteNotice";
import { PointWriteWarnings } from "./PointWriteWarnings";
import type { useCreatePoint } from "./use-create-point";
interface Props {
  form: ReturnType<typeof useCreatePoint>;
  onClose: () => void;
}
export function PointCreationForm({ form, onClose }: Props) {
  const fields = {
    value: form.input,
    onChange: form.setInput,
    isDisabled: form.write.isBusy || form.isSaved,
  };
  const actions = {
    label: "geography.points.create" as const,
    isDisabled: form.isDisabled,
    isBusy: form.write.isBusy,
    onClose,
  };
  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          form.create();
        }}
      >
        <PointInputFields {...fields} />
        <CreateActions {...actions} />
      </form>
      <WriteNotice outcome={form.write.outcome} />
      <PointWriteWarnings outcome={form.write.outcome} points={form.existing.data ?? []} />
    </>
  );
}
