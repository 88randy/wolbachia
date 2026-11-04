import type { MessageKey } from "@wolbachia/i18n";
import "i18next";

// Makes `t("...")` accept only keys that exist in the shared catalog.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    keySeparator: false;
    nsSeparator: false;
    resources: { translation: Record<MessageKey, string> };
  }
}
