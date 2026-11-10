import type { ShiftDetail } from "./shift-validation";
import { ShiftBlockerNotices } from "./ShiftBlockerNotices";
import { ShiftDecisionDialog } from "./ShiftDecisionDialog";
import page from "../styles/page.module.css";
interface Props {
  shift: ShiftDetail;
  isReady: boolean;
  readSequence: number;
}
export function ShiftActions({ shift, isReady, readSequence }: Props) {
  return (
    <div>
      <ShiftBlockerNotices shift={shift} isReady={isReady} />
      <div className={page.actions}>
        <ShiftDecisionDialog
          shift={shift}
          kind="observe"
          isReady={isReady}
          readSequence={readSequence}
        />
        <ShiftDecisionDialog
          shift={shift}
          kind="approve"
          isReady={isReady}
          readSequence={readSequence}
        />
      </div>
    </div>
  );
}
