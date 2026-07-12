# Store review — SeaCheck Mobile

**Google Play publication kit:** [docs/play-store/README.md](docs/play-store/README.md)

---

## Quick path for reviewers

1. Install the app (no account required).
2. **Onboarding:** Read navigation disclaimer → tap **I understand — continue**.
3. Grant **location** (foreground enough for map test).
4. Tap **Open SeaCheck** → land on **Map** tab.
5. **Downloads** → on Wi‑Fi, download **Kieler Bucht (test)** → wait for **Ready for offline use**.
6. Airplane mode → pan Kiel — offline charts still visible.
7. **Settings → About** — privacy policy, terms, map attribution links.

---

## Key product facts

| Topic | Answer |
|-------|--------|
| Login / server | **None** — standalone app |
| Ads / analytics | **None** |
| Primary navigation | **No** — aid to navigation only; disclaimer at onboarding |
| Location | Core feature; optional background for anchor/tracks |
| Data storage | On device only (passages, tracks, offline tiles) |

---

## Developer UAT

See [docs/test-it.md](docs/test-it.md) for full smoke test.

---

## Before submit

```bash
cd mobile/seacheck
npm run play:preflight
```

Then follow [docs/play-store/RELEASE-CHECKLIST.md](docs/play-store/RELEASE-CHECKLIST.md).
