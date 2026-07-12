# F-Droid submission draft

Copy `de.softwarebydesign.seacheck.yml` into a fork of https://gitlab.com/fdroid/fdroiddata at:

```text
metadata/de.softwarebydesign.seacheck.yml
```

Before opening the merge request:

1. Replace `COMMIT_PLACEHOLDER` with the git SHA of the release tag (e.g. `v0.1.0`)
2. Confirm `versionName` / `versionCode` match `app.config.ts` after `expo prebuild`
3. Run `fdroid lint de.softwarebydesign.seacheck` in fdroiddata CI
4. Replace draft screenshots in `fastlane/metadata/android/*/images/phoneScreenshots/`

See [BUILD-FDROID.md](BUILD-FDROID.md) for the full workflow.
