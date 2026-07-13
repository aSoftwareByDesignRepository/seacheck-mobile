# Region boundary fixtures

Canonical GeoJSON boundaries for corridor packs, checked into the app repo so CI and standalone clones do not depend on the monorepo `planning/` tree.

**Source of truth:** `src/map/regionPacks.ts` + `src/i18n/locales/en.json`

Regenerate after changing packs:

```bash
npm run sync:regions
```

In the monorepo this also updates `planning/app-ideas/seacheck/regions/`.
