# Google Play — release checklist

Tick off in order for the **first production** release.

---

## A. Accounts & legal

- [ ] [Google Play Console](https://play.google.com/console) developer account ($25), organisation **Software by Design GbR**
- [ ] D-U-N-S / business profile completed (organisation accounts)
- [ ] Deploy **`website/`** (includes SeaCheck legal pages) — see [PUBLISH-LEGAL.md](./PUBLISH-LEGAL.md)
- [ ] Verify live URLs with `curl -sI` (must return 200)
- [ ] Privacy + terms links work from app **Settings → About**
- [ ] Support email **info@software-by-design.de** monitored during review
- [ ] Impressum on [software-by-design.de](https://software-by-design.de/impressum/) covers app publisher

---

## B. Store assets

See [GRAPHICS.md](./GRAPHICS.md).

- [ ] App icon 512×512 (from `assets/icon.png`)
- [ ] Feature graphic 1024×500
- [ ] Phone screenshots ≥ 2
- [ ] Copy listing from [LISTING-en.txt](./LISTING-en.txt) (+ [LISTING-de.txt](./LISTING-de.txt) optional)

---

## C. App content declarations

- [ ] [DATA-SAFETY.md](./DATA-SAFETY.md) → Data safety form
- [ ] [CONTENT-RATING.md](./CONTENT-RATING.md) → Content rating
- [ ] [REVIEWER-ACCESS.md](./REVIEWER-ACCESS.md) → App access (no login)
- [ ] Target audience: **18+** or **not designed for children**
- [ ] Ads: **No**
- [ ] News app: **No**
- [ ] Government app: **No**
- [ ] Financial features: **No**
- [ ] Health features / body sensors: **No** (barometer removed in 0.1.2 — do not declare Health or upload a health demo video)

---

## D. Local preflight

```bash
cd mobile/seacheck
npm ci
npm run play:preflight
```

---

## E. Build production AAB

**Local (Android Studio / Gradle)** — see [`../build-it.md`](../build-it.md):

```bash
cd mobile/seacheck
cp keystore.properties.example keystore.properties   # once — point at your .jks / .keystore
npm run preflight
SEACHECK_APP_VARIANT=production npx expo prebuild --platform android --clean
npm run android:bundle
```

- [ ] Output: `android/app/build/outputs/bundle/release/app-release.aab`
- [ ] `version` in `app.config.ts` is correct (e.g. `1.0.0` for first public release)
- [ ] Bump `version` (and `android.versionCode` if not using EAS auto-increment) before each upload

**EAS (cloud alternative):**

```bash
npm i -g eas-cli && eas login && eas init
SEACHECK_APP_VARIANT=production EAS_BUILD_PROFILE=production EAS_PROJECT_ID=<uuid> \
  eas build --platform android --profile production
```

- [ ] Download `.aab` from [expo.dev](https://expo.dev)

### Play App Signing

- [ ] Enable **Google Play App Signing** on first upload
- [ ] Back up upload keystore if self-managed (`keystore.properties` + `.jks` / `.keystore`)

---

## F. Upload & rollout

- [ ] Play Console → Create app → **SeaCheck**
- [ ] Package name: `de.softwarebydesign.seacheck`
- [ ] **Internal testing** → upload AAB → install via Play
- [ ] Fix pre-launch report issues
- [ ] **Production** → release notes from [release-notes/](./release-notes/)
- [ ] Submit for review

Example release notes (EN):

```
Initial Play Store release.

• Offline coastal charts (OpenSeaMap seamarks + base map)
• GPS instruments, passage planning, anchor & arrival alarms
• Track recording and GPX export
• Navigation disclaimer — not a replacement for official charts
• No ads, no analytics
```

---

## G. iOS App Store (optional, later)

- [ ] Apple Developer Program ($99/year)
- [ ] App Store Connect app record
- [ ] Same privacy URL in App Privacy section
- [ ] `eas build --platform ios --profile production`
- [ ] TestFlight → App Review (location background justification required)

---

## H. Post-release

- [ ] Tag git: `seacheck-mobile@1.0.0`
- [ ] Plan updates: bump `version` in `app.config.ts`, `eas build`, staged rollout

---

## Optional: automated submit

```bash
SEACHECK_APP_VARIANT=production EAS_BUILD_PROFILE=production EAS_PROJECT_ID=<uuid> \
  eas build --platform android --profile production --auto-submit
```

Requires `eas.json` submit credentials (`eas credentials`).
