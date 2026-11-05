export const PIN_KEY_ROWS = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [-1, 0, -2],
];
export interface PinKeypadProps {
  readonly digit: (value: string) => void;
  readonly erase: () => void;
  readonly biometric: () => void;
  readonly canUseBiometrics: boolean;
  readonly isBusy: boolean;
}

export function pressPinKey(key: number, actions: PinKeypadProps): void {
  if (key >= 0) actions.digit(String(key));
  else if (key === -1) actions.biometric();
  else actions.erase();
}
