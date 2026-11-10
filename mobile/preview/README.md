# Mobile shared component preview (#203)

This developer-only harness renders the **actual** `mobile/src/ui/preview/StylePreview.tsx`
and its shared components through React Native Web 0.21.4. It is not an Android
emulator, screenshot mockup, or a replacement for the owner's approval on a debug APK.
Metro's Android entry does not import anything in this directory.

From the repository root, after `npm ci`:

```sh
node node_modules/vite/bin/vite.js --config mobile/preview/vite.config.mjs
```

Open `http://127.0.0.1:4203/?theme=light`, then repeat with `theme=dark`.
Add `lang=en` for English, `scale=130` for a **browser approximation** of text
scaling. The adapter scales only Text/TextInput font sizes and line heights,
leaving target sizes and the 360 × 800 frame unchanged. It does not qualify native
font scaling, glyph rasterization, keyboard avoidance, safe areas or TalkBack.

For the actual P22 fuel form, open
`http://127.0.0.1:4203/?screen=fuel&theme=light` and repeat with `theme=dark`,
`lang=en` and `scale=130`. The fixture starts at 4.5 L / 108 MXN / 12512 km with
no receipt photo. Fields and the full-refill choice change preview memory only;
Save runs the production validator without durable writes or server receipt.
The explicit synthetic camera port returns cancellation, preserving all values
without creating evidence. This preview is never an Android/device or API claim.

For the actual P18/P19 `ReleaseView`, open
`http://127.0.0.1:4203/?screen=release&theme=light`. Add `blocked=1` for P19's
non-overridable training blocker, `theme=dark`, `lang=en` or `scale=130` to inspect
the same view in each browser matrix state. The complete P18 fixture has a
synthetic task/device/permit/lot, eight passing fixture gates, quantity 2500,
synthetic GPS ±4 m and one synthetic evidence reference **without photo bytes**.
Changing quantity or Undo changes preview memory only. Taking a photo always
cancels; Save displays a preview-only explanation and never reports Phone saved.
Add `blocked=1&restart=1` to inspect the explicit fresh-draft recovery control
when newer prerequisites are available. Its action only explains the synthetic
boundary; it does not mutate an original source or create a stored draft.

The release preview renders the production view, header, controls and footer.
Only the header's navigation and sync hooks are replaced by browser-only no-op
navigation and an explicit synthetic offline snapshot. No app services, capture
controller, outbox, API, native GPS/camera or file/storage writer is created.
These Vite aliases apply only to this developer harness; Metro never reads them.
Screenshots are **browser-renderer evidence only** and do not qualify Android,
SQLCipher, camera, GPS, TalkBack, keyboard/safe-area behavior or either MO01 device
profile. Do not commit preview screenshots or a new evidence manifest.

For the actual P20 `SampleView`, open
`http://127.0.0.1:4203/?screen=sample&theme=light`, then repeat with `theme=dark`,
`lang=en` and `scale=130`. The bounded synthetic fixture has a lot source,
configured origin, a named verified-method label, raw code/Other fields, GPS and
one evidence reference without photo bytes. `blocked=1` shows missing capture
configuration; `entry=1` shows the source choice and retained own-work entry.
Add `entry=1&empty=1` for the unavailable downloaded-source state and its explicit
configuration refresh action.
`status=phone_saved|server_received|in_review|critical_rejected` selects an explicit
synthetic saved-state fixture, and `received=1` adds a synthetic exact-pair lab
receipt. These query fixtures are not server, lab or biological facts.
Editing, origin selection, Undo and opening/preparing a fixture change preview
memory only. Camera always cancels. Save explains that no capture was persisted.
The same browser-only navigation/sync aliases apply; no services, database,
outbox, native ports or network writes are instantiated. The Android/device,
TalkBack, force-stop and API limitations above apply equally to P20.

The browser adapters select the libraries' real web SVG/safe-area implementations
and refuse native
module calls (the SVG library statically imports an Android-only touch-sound module).
The web SVG library logs two warnings for native decorative accessibility props;
these do not establish Android accessibility behavior.

All fonts load from the installed local TTF assets. There is no CDN or API call.
All examples are synthetic; editing fields and retrying only changes preview
memory. Changing appearance in the preview does not change saved app preferences.

On Android, the same preview is at Settings → developer tools → Style preview
when the existing build flag `EXPO_PUBLIC_DEV_TOOLS=1` is set. Set the phone's
system font size to 130%, then inspect light/dark, both languages, wrapping,
TalkBack, the gesture area and the keyboard. Owner approval is required before merge.

Dependency references: [RN Web installation and compatibility](https://necolas.github.io/react-native-web/docs/installation/),
[Expo local fonts](https://docs.expo.dev/versions/latest/sdk/font/),
[Expo Google Fonts](https://github.com/expo/google-fonts).
