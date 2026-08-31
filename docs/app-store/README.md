# App Store Connect — listing copy

Paste into **Apps → SeaCheck → Distribution → App Store**. Primary language **English (U.S.)**. Add **German**.

| File | Where in App Store Connect |
|------|----------------------------|
| [LISTING-en.txt](./LISTING-en.txt) | English localization |
| [LISTING-de.txt](./LISTING-de.txt) | German localization |
| [REVIEW-NOTES.txt](./REVIEW-NOTES.txt) | App Review Information → Notes |

Screenshots: iPhone 6.5″ and iPad 13″ — capture per [../play-store/SCREENSHOT-CAPTURE.md](../play-store/SCREENSHOT-CAPTURE.md). Upload map shot first.

iOS build: `SEACHECK_APP_VARIANT=production eas build --platform ios --profile production`

**Background location:** required for anchor watch and track recording when the screen is off. Explain in review notes (see REVIEW-NOTES.txt).
