# “Ember ring” app icon: Icon Composer handoff (27/11/2026)

## What is in this folder

| File | What it is |
|---|---|
| `AppIcon.icon/` | The Icon Composer document (a folder: `icon.json` plus `Assets/ring.svg`, `Assets/dot.svg`). This is the file the app ships. |
| `composer/AppIcon-{Default,Dark,ClearLight,ClearDark,TintedLight,TintedDark}-1024.png` | 1024 px renders of the six iOS appearances, exported from `AppIcon.icon` with Apple's own renderer (`ictool`, Icon Composer in Xcode 27.1). Masked with the system corner shape, so they are for review, not for upload. |
| `flat/AppIcon-{light,dark,tinted}-1024.png` (+ `.svg`) | Square, opaque, unmasked 1024 PNGs. Use them for the App Store Connect marketing icon (light) and for the Expo object form fallback (see below). |
| `AppIcon-1024.svg/png`, `AppIcon-dark-1024.svg/png`, `layer-*.svg` | Earlier hand-drawn files, kept unchanged. |

## How the .icon file is built

- **Background:** the document fill. Solid `#FF6A00` by default and `#141210` in Dark. Clear and Tinted have no fill of their own, so the system draws its glass or tint there.
- **Group 1 (Liquid Glass on, specular on, neutral shadow 50 %, translucency 20 %):**
  - `ring`: the open C ring. Default `#0B0A09` (from the SVG). Dark `#FF6A00`. Tinted white, so the ring is the brightest and most recognisable part, as Apple's mono guidance asks.
  - `dot`: the ember dot. Default `#0B0A09`. Dark `#FF7A1F`. Tinted `#CCCCCC`.
- Both layers are 1024 × 1024, square and unmasked. The glyph is shifted 18 px to the right so the C plus dot looks optically centred.

## Steps for Phương (by hand, about 5 minutes)

1. **Open it.** In Finder, double-click `icon/AppIcon.icon` (or open Xcode → Open Developer Tool → Icon Composer, then File → Open).
2. **Check the six appearances.** Use the appearance switcher at the bottom of the canvas (Default / Dark / Clear light / Clear dark / Tinted light / Tinted dark) and compare with `composer/*.png`. They should match. In the right panel, the iPhone preview shows the home-screen size.
3. **Optional tuning, only if you want it:**
   - Select the group to adjust *Specular*, *Shadow* (Neutral or Chromatic) and *Translucency*.
   - Select `ring` or `dot` and change *Fill* for one appearance only by first choosing that appearance in the switcher. A value set this way becomes a per-appearance override.
   - Save with ⌘S. Then run the export command below again so the PNGs match.
4. **Export for the App Store (if Xcode does not do it for you):** File → Export, choose iOS, Default, 1024 px. Or upload `flat/AppIcon-light-1024.png`, which is already square and opaque.

## Shipping it in the React Native + Expo app (iOS only)

- **Expo SDK 54 or newer:** copy `AppIcon.icon` to `assets/` and set this in `app.json`:
  ```json
  { "expo": { "ios": { "icon": "./assets/AppIcon.icon" } } }
  ```
  Expo then uses the Icon Composer file, and Dark, Clear and Tinted come from the file itself. Rebuild the native project (`npx expo prebuild --clean` or a new EAS build), because the icon is a native asset.
- **Older SDK, or as a fallback:** use the object form with the flat PNGs (1024, square, no transparency, no rounded corners):
  ```json
  { "expo": { "ios": { "icon": {
      "light": "./assets/icon/AppIcon-light-1024.png",
      "dark": "./assets/icon/AppIcon-dark-1024.png",
      "tinted": "./assets/icon/AppIcon-tinted-1024.png" } } } }
  ```
  With this form there is no Liquid Glass and no Clear appearance. That is acceptable on older iOS only.
- **Bare Xcode project:** drag `AppIcon.icon` into the Xcode project navigator (target membership: the app). In Build Settings, set *App Icon* (`ASSETCATALOG_COMPILER_APPICON_NAME`) to `AppIcon`, the file name without `.icon`.

## Re-exporting the PNGs after a change

```sh
IC="/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool"
for r in Default Dark ClearLight ClearDark TintedLight TintedDark; do
  "$IC" icon/AppIcon.icon --export-image --output-file icon/composer/AppIcon-$r-1024.png \
    --platform iOS --rendition $r --width 1024 --height 1024 --scale 1
done
```

## Sources checked

- Apple HIG, App icons (layers, appearances: default, dark, clear, tinted): https://developer.apple.com/design/human-interface-guidelines/app-icons
- Icon Composer: https://developer.apple.com/icon-composer/
- Expo, App icons (`ios.icon` with a `.icon` file from SDK 54; light/dark/tinted object form): https://docs.expo.dev/develop/user-interface/app-icons/
