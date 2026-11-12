/** Where a scan can start, and the source that must lead to the shared scanner screen. */
export const SCANNER_ENTRY_POINTS: readonly { name: string; file: string; pattern: RegExp }[] = [
  {
    name: "generic scan tile (Mi dia)",
    file: "navigation/ScreenRouter.tsx",
    pattern: /qrScanner: P11Screen/,
  },
  {
    name: "placement label, review and bag scans",
    file: "features/ovitrap-check/ScannerScreen.tsx",
    pattern:
      /<P11Screen expected="ovitrap" eventId=\{eventId\} bindsLabel \/>[\s\S]*<P11Screen expected=\{target\}/,
  },
  {
    name: "placement label button",
    file: "features/ovitrap-check/LabelPage.tsx",
    pattern: /name: "ovitrapScanner", target: "label"/,
  },
];
