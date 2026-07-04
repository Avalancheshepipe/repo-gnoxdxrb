# Julow — Native Android app (Expo)

A native React Native experience (Expo SDK 54, New Architecture, Reanimated 4 +
Hermes worklets). Platform behaviour is split with `*.android.tsx` / `*.ios.tsx`
files — no runtime `Platform.select`.

## Architecture

```
mobile/
  app/                      Expo Router routes
    _layout.tsx             Providers: GestureHandlerRoot, KeyboardProvider,
                            SafeArea, tRPC + React Query, Theme, BottomSheetModal
    index.tsx               Auth gate → /inbox (non-canvas default) or /sign-in
    sign-in.tsx             Themed auth (keyboard-aware)
    (tabs)/
      _layout.tsx           Tabs with a custom floating blurred tab bar
      board.tsx             Canvas via WebView (forwards session cookie)
      inbox.tsx             Task list (real tRPC data)
      agents.tsx            Chat (keyboard-controller driven composer)
      automations.tsx       Automations list + toggle
  src/
    theme/                  tokens.ts (light/dark, glow trio) + ThemeProvider
    ui/                     GradientBackground.{android,ios}, GlassSurface.{android,ios},
                            PressableScale, IconButton, Card, Sheet, Txt
    components/             TabBar.{android,ios}, AppHeader.{android,ios}
    hooks/useOrg.ts         Active organization resolver
    api.ts / auth.ts        tRPC client + better-auth (LAN host auto-resolve)
    strings.ts              ru/en strings (Russian default, matches web)
```

Design notes:

- **Background**: orange / purple / blue radial glows over the base color via
  `react-native-svg` — the same mesh-glow language as the web shell, in both
  light and dark themes.
- **Chrome blur**: tab bar + header use `expo-blur`. Android opts into
  `experimentalBlurMethod="dimezisBlurView"` for a real backdrop blur.
- **No elevation/shadow on Android** — hairline borders + surface tints instead.
- **Sheets / dropdowns are solid**; only the chrome bars are blurred.
- **Animations**: Reanimated 4 springs for press + tab transitions; built-in
  `FadeIn*` layout animations to keep custom worklet count (and Hermes bundle
  weight) low.

## First-time setup (run on your machine — has the Pixel 10 Pro)

```bash
cd mobile

# 1. Align all dependency versions to Expo SDK 54, then install
npx expo install --fix
npm install

# 2. Java 17 (required by the Android Gradle Plugin).
#    Easiest on Windows:
winget install --id EclipseAdoptium.Temurin.17.JDK
#    Then point JAVA_HOME at it (adjust the path to the installed version):
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot"
#    Open a NEW terminal so JAVA_HOME is picked up.

# 3. Android SDK: install Android Studio (SDK + platform-tools + an
#    Android 14/15 platform). Set:
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
#    and add platform-tools to PATH (new terminal afterwards).

# 4. Generate the native android/ project
npm run prebuild:android      # expo prebuild --platform android --clean
```

## Build & run on the Pixel 10 Pro

```bash
# Enable USB debugging on the phone, connect it, then verify:
adb devices

# Make the local web API reachable from the device over USB:
adb reverse tcp:3000 tcp:3000

# Start the web backend in the repo root (separate terminal):
#   cd ..  &&  npm run dev        # serves http://localhost:3000

# Build the dev client and launch it on the device:
cd mobile
npm run android                 # expo run:android  (Gradle build + install + run)
```

Networking: `src/auth.ts` auto-derives the dev-machine LAN IP from Expo's
`hostUri`, so Wi-Fi also works without `adb reverse`. To pin it explicitly:

```bash
# PowerShell, before `npm run android`
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.20:3000"
```

## Notes / follow-ups

- The agents chat composer is wired for native UX (keyboard-controller,
  optimistic turns); connect it to the streaming `/api/ai/chat` endpoint next.
- `@gorhom/bottom-sheet` v5 + Reanimated 4: if you hit a runtime mismatch, bump
  bottom-sheet to its latest patch (`npx expo install @gorhom/bottom-sheet`).
- iOS files exist for parity but the current focus is Android.
