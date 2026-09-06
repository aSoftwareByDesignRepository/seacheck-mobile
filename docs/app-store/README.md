# App Store Connect — listing copy

Paste into **Apps → SeaCheck → Distribution → App Store**. Primary language **English (U.S.)**. Add **German**.

| File | Where in App Store Connect |
|------|----------------------------|
| [LISTING-en.txt](./LISTING-en.txt) | English localization |
| [LISTING-de.txt](./LISTING-de.txt) | German localization |
| [REVIEW-NOTES.txt](./REVIEW-NOTES.txt) | App Review Information → Notes |
| [APP-PRIVACY.txt](./APP-PRIVACY.txt) | App Privacy questionnaire answers |
| [GRAPHICS.md](./GRAPHICS.md) | Screenshot sizes + shot map |

## Screenshots

Generate framed assets (iPhone 6.5″ + iPad 13″):

```bash
cd mobile/seacheck
npm run play:screenshots
npm run appstore:screenshots
```

Upload `docs/app-store/assets/iphone-65-*.png` and `ipad-13-*.png`. Put the **map** shot first.

Prefer replacing placeholders with live Simulator captures under `docs/app-store/assets/captures/` (see GRAPHICS.md).

## Build

```bash
SEACHECK_APP_VARIANT=production eas build --platform ios --profile production
```

**Background location:** required for anchor watch and track recording when the screen is off. Explained in REVIEW-NOTES.txt and onboarding.

**Encryption:** `ITSAppUsesNonExemptEncryption` / `usesNonExemptEncryption: false` in `app.config.ts`.
