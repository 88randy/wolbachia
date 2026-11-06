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
