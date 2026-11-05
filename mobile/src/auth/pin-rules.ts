export const PIN_LENGTH = 4;
// [ASSUMPTION] Local full-password failures before online reauthentication.
export const PASSWORD_ATTEMPT_LIMIT = 5;

export function isAllowedPin(pin: string): boolean {
  if (!new RegExp(`^\\d{${String(PIN_LENGTH)}}$`).test(pin)) return false;
  if (/^(\d)\1+$/.test(pin)) return false;
  const steps = Array.from({ length: pin.length }, (_, index) => pin.charAt(index))
    .slice(1)
    .map((digit, index) => Number(digit) - Number(pin[index]));
  return !steps.every((step) => step === 1) && !steps.every((step) => step === -1);
}
