#!/usr/bin/env bash
# Pre-submit checks for Google Play. Run from mobile/seacheck.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Typecheck"
npm run typecheck

echo "==> i18n parity"
npm run i18n:parity

echo "==> Unit tests"
npm test -- --passWithNoTests

echo "==> Store listing contracts"
npm test -- --testPathPattern='(playStoreListingContract|appStoreReviewContract)' --ci

echo "==> Play kit files"
required=(
  docs/play-store/README.md
  docs/play-store/ASO.md
  docs/play-store/SCREENSHOT-CAPTURE.md
  docs/play-store/LISTING-en.txt
  docs/play-store/LISTING-de.txt
  docs/play-store/DATA-SAFETY.md
  docs/play-store/CONTENT-RATING.md
  docs/play-store/REVIEWER-ACCESS.md
  docs/play-store/RELEASE-CHECKLIST.md
  docs/play-store/GRAPHICS.md
  docs/play-store/PUBLISH-LEGAL.md
  docs/play-store/privacy-mobile-en.md
  docs/play-store/privacy-mobile-de.md
  docs/play-store/terms-mobile-en.md
  docs/play-store/terms-mobile-de.md
  docs/play-store/publish/README.md
  docs/play-store/publish/en/privacy-seacheck-mobile.html
  docs/play-store/publish/de/datenschutz-seacheck-mobile.html
  docs/play-store/assets/feature-graphic-1024x500.png
  docs/play-store/assets/play-icon-512.png
  docs/app-store/README.md
  docs/app-store/LISTING-en.txt
  docs/app-store/LISTING-de.txt
  docs/app-store/REVIEW-NOTES.txt
  docs/app-store/GRAPHICS.md
  docs/app-store/APP-PRIVACY.txt
  fastlane/metadata/android/en-US/title.txt
  fastlane/metadata/android/de-DE/title.txt
  fastlane/metadata/android/en-US/images/featureGraphic/featureGraphic.png
  keystore.properties.example
  ../../website/en/privacy-seacheck-mobile.html
  ../../website/en/terms-seacheck-mobile.html
  ../../website/de/datenschutz-seacheck-mobile.html
  ../../website/de/nutzungsbedingungen-seacheck-mobile.html
)
for f in "${required[@]}"; do
  [[ -f "$f" ]] || { echo "Missing: $f"; exit 1; }
done

echo "==> Screenshot placeholders (min 6)"
for n in 01-map 02-disclaimer 03-passage 04-downloads 05-offline 06-about; do
  [[ -f "docs/play-store/assets/screenshots/phone-${n}.png" ]] || {
    echo "Missing screenshot: docs/play-store/assets/screenshots/phone-${n}.png (run: npm run play:screenshots)"
    exit 1
  }
done

echo "==> App Store framed screenshots (min 6 iPhone 6.5″ + 6 iPad)"
for n in 01 02 03 04 05 06; do
  [[ -f "docs/app-store/assets/iphone-65-${n}.png" ]] || {
    echo "Missing App Store shot: docs/app-store/assets/iphone-65-${n}.png (run: npm run appstore:screenshots)"
    exit 1
  }
  [[ -f "docs/app-store/assets/ipad-13-${n}.png" ]] || {
    echo "Missing App Store shot: docs/app-store/assets/ipad-13-${n}.png (run: npm run appstore:screenshots)"
    exit 1
  }
done

echo "==> Assets"
[[ -f assets/icon.png ]] || { echo "Missing assets/icon.png"; exit 1; }

echo "==> Legal URLs (app)"
grep -q 'privacy-seacheck-mobile' src/lib/legal/legalUrls.ts \
  || { echo "Update privacyPolicyUrl in src/lib/legal/legalUrls.ts"; exit 1; }

echo "==> Listing version sync"
PKG_VER="$(node -p "require('./package.json').version")"
grep -q "Version: ${PKG_VER}" docs/app-store/LISTING-en.txt \
  || { echo "docs/app-store/LISTING-en.txt Version must be ${PKG_VER}"; exit 1; }
grep -q "version ${PKG_VER}" docs/app-store/REVIEW-NOTES.txt \
  || { echo "docs/app-store/REVIEW-NOTES.txt must cite version ${PKG_VER}"; exit 1; }

echo ""
echo "OK — local preflight passed."
echo "Next: deploy website/ (docs/play-store/PUBLISH-LEGAL.md), replace illustrative screenshots with live captures when possible, then:"
echo "  SEACHECK_APP_VARIANT=production EAS_BUILD_PROFILE=production EAS_PROJECT_ID=<uuid> eas build --platform android --profile production"
echo "  SEACHECK_APP_VARIANT=production eas build --platform ios --profile production"
