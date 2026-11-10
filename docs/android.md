# Pips Archive for Android

The Capacitor app bundles the game, puzzle JSON, analysis sidecars and fonts. It starts and plays without an internet connection. This version includes the archive available at build time; rebuild and install an update to obtain later puzzles. The website's scheduled fetch/deploy workflows remain separate.

All hint levels are free, including on first solves. Only active play time contributes to results, statistics and sharing. Hints do not exclude results from performance scoring or calibration. Old version-1 hint receipts are validated and preserved for backup compatibility; their historical penalties are ignored when scoring/displaying times. A lightbulb on an imported result only records hint usage.

## Build

Use Node 22.12+ (or 24), JDK 21, Android SDK platform/build tools 36 and an Android device or emulator running Android 7.0/API 24 or newer.

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run test:mobile
npm run build:android
cd android
./gradlew assembleDebug lintDebug
```

On Windows run `gradlew.bat` instead. Set `JAVA_HOME` and `ANDROID_HOME`, or set `sdk.dir` in ignored `android/local.properties`. To inspect/run in Android Studio use `npm run open:android`. To preview just the app client use `npm run dev:android`.

The development APK is `android/app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions also attaches this development build to the Android APK workflow. It uses a development signing identity and is separate from the locally delivered release build.

## Signed release

Generate and retain a private keystore, then set `PIPS_KEYSTORE` (absolute path), `PIPS_KEYSTORE_PASSWORD`, and optionally `PIPS_KEY_ALIAS` (default `pipsarchive`) and `PIPS_KEY_PASSWORD` (defaults to the store password). Run `npm run build:android` then `./gradlew assembleRelease lintRelease` from `android/`. Signed output is `android/app/build/outputs/apk/release/app-release.apk`. With no signing environment, release output is unsigned and requires signing before installation.

For the initial delivered APK the private key and its local configuration are retained in `C:\Users\aeple\.android\pips-archive-signing\`. Keep that folder backed up privately: future updates must use the same key and a higher `versionCode` in `android/app/build.gradle`. Neither keys nor passwords are committed or included in the source ZIP.

App ID: `com.aepler315.pipsarchive`. Version: `1.0`, version code `1`.

## Install and data

Copy the release APK to the Android device and open it. Allow installation from the app you used to open the APK if Android requests it. Alternatively run `adb install -r path/to/pips-archive-1.0.apk`.

Progress is stored locally in the app and is separate from browser/website storage. Use Stats → Export on the website and Stats → Import in Android to transfer existing records. On Android, backups and PNG results use the system share sheet, including any installed file/storage targets. Import uses the Android document picker. Export a backup before uninstalling or clearing app data.

Android Back first closes a dialog/menu, otherwise navigates back through the app, returns a directly opened puzzle to the archive, or minimizes the app from its initial archive page. Backgrounding saves touched progress and pauses the active-play timer; foregrounding resumes it.

## Checks

`npm test` includes free-hint, historical import, analytics, native Back-policy and binary export regressions. `npm run test:mobile` uses the real touch interface with external network requests blocked, completes a puzzle using placement hints, reloads it and verifies the persisted result in Stats. The existing website browser suite remains available as `npm run test:browser` after `npm run build`.
