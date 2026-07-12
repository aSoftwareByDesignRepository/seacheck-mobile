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
npm test -- --passWithNoTests 2>/dev/null || npm test

echo "==> Play kit files"
required=(
  docs/play-store/README.md
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
  ../../website/en/privacy-seacheck-mobile.html
  ../../website/en/terms-seacheck-mobile.html
  ../../website/de/datenschutz-seacheck-mobile.html
  ../../website/de/nutzungsbedingungen-seacheck-mobile.html
)
for f in "${required[@]}"; do
  [[ -f "$f" ]] || { echo "Missing: $f"; exit 1; }
done

echo "==> Assets"
[[ -f assets/icon.png ]] || { echo "Missing assets/icon.png"; exit 1; }

echo "==> Legal URLs (app)"
grep -q 'privacy-seacheck-mobile' src/lib/legal/legalUrls.ts \
  || { echo "Update privacyPolicyUrl in src/lib/legal/legalUrls.ts"; exit 1; }

echo ""
echo "OK — local preflight passed."
echo "Next: deploy website/ (docs/play-store/PUBLISH-LEGAL.md), graphics, then:"
echo "  SEACHECK_APP_VARIANT=production EAS_BUILD_PROFILE=production EAS_PROJECT_ID=<uuid> eas build --platform android --profile production"
