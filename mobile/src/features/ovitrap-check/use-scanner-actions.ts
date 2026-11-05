import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import type { Route } from "../../navigation/routes.ts";
import { parseQr, UUID_PATTERN } from "./domain.ts";
import type { M08Model } from "./use-m-08.ts";
interface Input {
  readonly model: M08Model;
  readonly target: "ovitrap" | "bag";
  readonly code: string;
}
type Push = (route: Route) => void;
function enterCode({ model, target, code }: Input, push: Push): void {
  const isQr = parseQr(code.trim(), target) !== null;
  const isManualValid =
    target === "ovitrap"
      ? UUID_PATTERN.test(code.trim())
      : /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/.test(code.trim());
  if (!isQr && !isManualValid) {
    push({ name: "invalidOvitrapCode", target });
    return;
  }
  void model
    .run(
      () =>
        target === "bag"
          ? model.service.enterBag(code)
          : model.service.startCheck(code.trim(), true),
      target === "ovitrap",
    )
    .then((ok) => {
      if (ok) push({ name: "ovitrapCapture" });
    });
}
function scanCode({ model, target }: Input, push: Push): void {
  void model.run(async () => {
    const result = await model.service.scan(target);
    if (result === "invalid") push({ name: "invalidOvitrapCode", target });
    if (result === "unavailable") model.setError("mobile.ovitrap.scannerUnavailable");
    if (result === "read") push({ name: "ovitrapCapture" });
  }, target === "ovitrap");
}
export function useScannerActions(input: Input) {
  const { push } = useNavigation();
  return {
    scan: () => {
      scanCode(input, push);
    },
    enter: () => {
      enterCode(input, push);
    },
  };
}
