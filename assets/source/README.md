# SeaCheck app icon sources

PNG icons in `assets/` are generated from these SVGs. The design is a **compass rose**
on an ocean-navy gradient aligned with the mobile theme (`#0b1622`, primary `#0073ad`).

| Source | Used for |
|--------|----------|
| `icon-full.svg` | `icon.png`, `splash-icon.png`, `favicon.png` |
| `brand-mark.svg` | `brand-logo.png` (optional marketing / splash) |
| `icon-foreground.svg` | `android-icon-foreground.png` |
| `icon-background.svg` | `android-icon-background.png` |
| `icon-monochrome.svg` | `android-icon-monochrome.png` |

Regenerate:

```bash
npm run icons
```

After regenerating, sync native projects and reinstall (Metro does not update the launcher icon):

```bash
npm run android:rebuild
```

`npm run icons` also writes Android splash/notification drawables and runs `expo prebuild` for adaptive launcher mipmaps.
