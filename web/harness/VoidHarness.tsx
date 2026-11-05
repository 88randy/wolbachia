import { useState } from "react";
import { useTranslation } from "react-i18next";
import { VoidedDetail } from "../src/data-table/VoidedDetail";
import type { VoidChoice } from "../src/void/use-void-form";
import type { VoidResult } from "../src/void/submit-void";
import { VoidDialog } from "../src/void/VoidDialog";
import { DEFAULT_VOID_LIMITS } from "../src/void/void-limits";
import type { VoidLimits } from "../src/void/void-limits";
import type { VoidInfo } from "../src/void/void-info";

interface HarnessProps {
  /** What the pretend server answers; receives the selected reason and optional normalized text. */
  submit: (choice: VoidChoice) => Promise<VoidResult>;
  limits?: VoidLimits;
}

const ALREADY_VOIDED: VoidInfo = {
  reason: "Folio duplicado",
  author: "Marco Reyes",
  when: "12 sep 2026",
};

/**
 * DEV AND TEST ONLY (not a route of the app): a two-row list and a void button, wired the way a
 * real screen wires `VoidDialog` and `VoidedCell`. Tests and `web/harness/void.html` use it to
 * see the pattern working without a backend.
 */
export function VoidHarness({ submit, limits = DEFAULT_VOID_LIMITS }: HarnessProps) {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);
  const [info, setInfo] = useState<VoidInfo | null>(null);
  return (
    <main>
      <table>
        <caption>Ovitrampas</caption>
        <tbody>
          <tr>
            <td>
              OV-010
              {info && <VoidedDetail info={info} />}
            </td>
            <td>
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                }}
              >
                {t("common.actions.void")} OV-010
              </button>
            </td>
          </tr>
          <tr>
            <td>
              <s>OV-019</s>
              <VoidedDetail info={ALREADY_VOIDED} />
            </td>
            <td />
          </tr>
        </tbody>
      </table>
      {isOpen && (
        <VoidDialog
          record="OV-010"
          limits={limits}
          submit={submit}
          onCancel={() => {
            setOpen(false);
          }}
          onVoided={() => {
            setOpen(false);
            setInfo({ reason: "Capturado dos veces", author: "Ana Pérez" });
          }}
        />
      )}
    </main>
  );
}
