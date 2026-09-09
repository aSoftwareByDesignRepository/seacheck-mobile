Phone screenshots for store listings live in the F-Droid / Play metadata tree:

```text
fastlane/metadata/android/en-US/images/phoneScreenshots/
fastlane/metadata/android/de-DE/images/phoneScreenshots/
```

7″ / 10″ Play slots: `…/images/sevenInchScreenshots/` and `tenInchScreenshots/` (locale-correct full-bleed only).

Older raw landscape dumps (often grey-void / collage — **do not promote as-is**) live in `tablet-landscape/`.

Capture per `docs/play-store/GRAPHICS.md` and `.cursor/store-farm/seacheck-play-shot-list.md`, then copy into fastlane — never clone en↔de.
