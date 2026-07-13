# F-Droid submission draft

Copy `de.softwarebydesign.seacheck.yml` into a fork of https://gitlab.com/fdroid/fdroiddata at:

```text
metadata/de.softwarebydesign.seacheck.yml
```

Before opening the merge request:

1. Pin `commit:` in `de.softwarebydesign.seacheck.yml` to the release tag SHA (e.g. `4898b3c` for `v0.1.1`)
2. Confirm `versionName` / `versionCode` match `app.config.ts` after `expo prebuild`
3. Ensure fdroiddata CI passes `fdroid rewritemeta` and `fdroid build` on the MR
4. Replace draft screenshots in `fastlane/metadata/android/*/images/phoneScreenshots/`

See [BUILD-FDROID.md](BUILD-FDROID.md) for the full workflow.
