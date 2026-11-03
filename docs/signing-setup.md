# Signing setup for 雅偉之界 / Yahweh's World (paths and ids only; no secret is in this file)

Created 2026-11-04. Team `YC5JZD3DY7`, bundle id `com.yahwehword.world` (ASC bundle id resource `32UK4R8CJ8`, ASC app `6830164556`).

**Back up `~/Documents/CodingProject-secrets-local/yahwehs-world/` to the PasswordManager folder in Drive.** Losing the Android upload keystore means a Play upload-key reset request.

## Apple (created through the App Store Connect API key `546XS5ZAS5`)
| What | Id / name |
|---|---|
| Apple Distribution certificate | `V6D4VV2K24`, expires 2027-11-03 |
| Mac Installer Distribution (3rd Party Mac Developer Installer) | `5733XK5344`, expires 2027-11-03 |
| iOS App Store profile | `495RSHVC2W` "YW World iOS AppStore v2" (uuid 9fd05a13-9060-4926-8250-011c4727f7b7) |
| Mac App Store profile | `GPHFL27772` "YW World macOS AppStore v2" (uuid a096ac31-4dac-4e17-adf5-e9525b39c958) |
| Capability on the bundle id | Associated Domains (needed by the app-link entitlement) |
| Superseded, unused | profiles `36HNVTT7C3`, `2P8237468B` (made before the capability; nothing was deleted) |

Files (outside any git repo): `~/Documents/CodingProject-secrets-local/yahwehs-world/` holds `dist.{key,csr,cer,pem,p12}`, `inst.{...}`,
`ios-appstore.mobileprovision`, `macos-appstore.provisionprofile`, `yahwehs-world-upload.jks`. Profiles are also installed in `~/Library/MobileDevice/Provisioning Profiles/`.
Keychain: the identities live in `~/Library/Keychains/yw-signing.keychain-db` (put first in the user search list; created so codesign never prompts).
Generic-password items in the login keychain: service `yahwehs-world-p12-dist`, `yahwehs-world-p12-inst` (p12 passwords), `yahwehs-world-signing-keychain` (account `yw-signing`), `yahwehs-world-upload-keystore` (account `yahwehsworld-upload`).
After a reboot: `security unlock-keychain -p "$(security find-generic-password -a yw-signing -s yahwehs-world-signing-keychain -w)" ~/Library/Keychains/yw-signing.keychain-db`.

## Android
Upload keystore `~/Documents/CodingProject-secrets-local/yahwehs-world/yahwehs-world-upload.jks`, alias `yahwehsworld-upload`, RSA 4096, 10,000 days.
SHA-256 of the upload certificate: 49:C2:41:EB:0D:D6:87:1F:60:76:82:7C:86:71:47:EC:38:F6:C4:67:44:D6:C0:27:5F:3A:BA:DF:91:E0:5F:73
(the Play App Signing certificate, shown in Play Console > App integrity, is the one for `assetlinks.json`).
Gradle reads it as the build script documents: `ORG_GRADLE_PROJECT_ywKeystorePath`, `ORG_GRADLE_PROJECT_ywKeyAlias`, `YW_KEYSTORE_PASSWORD` (from the keychain item above); no key.properties is used.

## Commands that worked (1.0.0, build 1)
- iOS: `VITE_SHELL_CHANNEL=store cargo tauri ios build --export-method app-store-connect` (the archive is made; Tauri's own export fails with "requires a profile with Associated Domains"), then
  `xcodebuild -exportArchive` with a manual export-options plist (method app-store-connect, destination export, manual signing, `provisioningProfiles` = {com.yahwehword.world: "YW World iOS AppStore v2"}), then `xcrun altool --upload-package ... --type ios --apple-id 6830164556 --bundle-id com.yahwehword.world --bundle-short-version-string 1.0.0 --bundle-version 1 --apiKey ... --apiIssuer ...`.
  `gen/apple/project.yml` needs DEVELOPMENT_TEAM, manual signing and the v2 profile (gen/ is gitignored); `tools/shell/ios_patch.py` now also keeps `Externals/libapp.a` out of the bundle resources (App Store rejects it, error 90171).
- macOS: `APPLE_SIGNING_IDENTITY="Apple Distribution: <name> (<team>)" cargo tauri build --config src-tauri/tauri.macos-appstore.conf.json --bundles app`, then `productbuild --component <app> /Applications --sign "3rd Party Mac Developer Installer: <name> (<team>)" <pkg>`, then altool `--type macos`.
- Android: `tools/build_android.sh --aab` with the three variables above. versionCode follows the project formula (1.0.0 build 1 = 10000001).
