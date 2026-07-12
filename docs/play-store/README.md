# Google Play — share SeaCheck (not a launch)

How to put SeaCheck on Play **unlisted** for anyone with the link — without marketing it. See **[SHARE.md](./SHARE.md)** first.

For full technical steps (build, data safety, legal pages): table below and [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md).

| File | Use |
|------|-----|
| [SHARE.md](./SHARE.md) | **Start here** — unlisted share, pull-down, what to skip |
| [LISTING-en.txt](./LISTING-en.txt) | Store listing (English) |
| [LISTING-de.txt](./LISTING-de.txt) | Store listing (German) |
| [DATA-SAFETY.md](./DATA-SAFETY.md) | **Data safety** form |
| [CONTENT-RATING.md](./CONTENT-RATING.md) | **Content rating** (IARC) |
| [REVIEWER-ACCESS.md](./REVIEWER-ACCESS.md) | **App access** (no login) |
| [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) | Build AAB, upload, go-live |
| [GRAPHICS.md](./GRAPHICS.md) | Screenshots, feature graphic |
| [privacy-mobile-en.md](./privacy-mobile-en.md) | Privacy policy source (EN) |
| [privacy-mobile-de.md](./privacy-mobile-de.md) | Privacy policy source (DE) |
| [terms-mobile-en.md](./terms-mobile-en.md) | Terms & navigation notice (EN) |
| [terms-mobile-de.md](./terms-mobile-de.md) | Nutzungsbedingungen (DE) |
| [PUBLISH-LEGAL.md](./PUBLISH-LEGAL.md) | Deploy via **`website/`** (see below) |
| [publish/README.md](./publish/README.md) | Pointer to `website/` HTML |
| [release-notes/](./release-notes/) | Play release notes per version |

**Local check:** `npm run play:preflight` from `mobile/seacheck`.

---

## What you need to do (summary)

### 1. Deploy website (with your normal site publish)

Legal HTML is in **`website/en/`** and **`website/de/`** (not linked from site nav). See [PUBLISH-LEGAL.md](./PUBLISH-LEGAL.md).

### 2. Graphics (you)

Create feature graphic + screenshots per [GRAPHICS.md](./GRAPHICS.md). Minimum: 2 phone screenshots + 512×512 icon.

### 3. Play Console setup (you)

Follow [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md):

- Developer account & organisation profile
- Paste listings, privacy URL, data safety, content rating
- Upload production AAB

### 4. Build (terminal)

```bash
cd mobile/seacheck
npm run play:preflight
eas login && eas init
SEACHECK_APP_VARIANT=production EAS_BUILD_PROFILE=production EAS_PROJECT_ID=<uuid> \
  eas build --platform android --profile production
```

### 5. Lawyer (recommended)

In-app + web disclaimers reduce risk but do **not** replace legal review for a navigation product in Germany/EU.

---

## Developer contact (Play Console)

| Field | Value |
|-------|--------|
| Developer name | Software by Design GbR |
| Email | info@software-by-design.de |
| Privacy / DPO | datenschutz@software-by-design.de |
| Address | Husumer Baum 2, 24837 Schleswig, Germany |
| Website | https://software-by-design.de |

---

## Related docs

- [../STORE_REVIEW.md](../STORE_REVIEW.md) — reviewer smoke path  
- [../test-it.md](../test-it.md) — developer UAT  
- [../build-it.md](../build-it.md) — dev environment
