# AudioCheck app icon sources

PNG icons in `assets/` are generated from these SVGs. The design matches the
Nextcloud **audiocheck** app mark (headphones + compliance check) on a deep navy
gradient aligned with the mobile splash (`#1a1a2e`).

| Source | Used for |
|--------|----------|
| `icon-full.svg` | `icon.png`, `splash-icon.png`, `favicon.png` |
| `brand-mark.svg` | `brand-logo.png` (optional marketing / login) |
| `icon-foreground.svg` | `android-icon-foreground.png` |
| `icon-background.svg` | `android-icon-background.png` |
| `icon-monochrome.svg` | `android-icon-monochrome.png` |

Regenerate:

```bash
npm run icons
```

After regenerating, sync native projects and reinstall (Metro does not update the launcher icon):

```bash
npx expo prebuild --platform android --no-install
npm run android
```
