# Publish legal pages (Play & App Store)

SeaCheck legal HTML lives in the monorepo **`website/`** folder. Pages are **not** linked from site navigation — only from the mobile app and store listings.

Deploy with your normal **nextcloud.software-by-design.de** website publish.

---

## Public URLs → source files

| Public URL | Edit this file |
|------------|----------------|
| `https://nextcloud.software-by-design.de/en/privacy-seacheck-mobile.html` | [`website/en/privacy-seacheck-mobile.html`](../../../../website/en/privacy-seacheck-mobile.html) |
| `https://nextcloud.software-by-design.de/en/terms-seacheck-mobile.html` | [`website/en/terms-seacheck-mobile.html`](../../../../website/en/terms-seacheck-mobile.html) |
| `https://nextcloud.software-by-design.de/de/datenschutz-seacheck-mobile.html` | [`website/de/datenschutz-seacheck-mobile.html`](../../../../website/de/datenschutz-seacheck-mobile.html) |
| `https://nextcloud.software-by-design.de/de/nutzungsbedingungen-seacheck-mobile.html` | [`website/de/nutzungsbedingungen-seacheck-mobile.html`](../../../../website/de/nutzungsbedingungen-seacheck-mobile.html) |

Long-form source (for edits, then sync to HTML in **`website/`**): [privacy-mobile-en.md](./privacy-mobile-en.md), [privacy-mobile-de.md](./privacy-mobile-de.md), [terms-mobile-en.md](./terms-mobile-en.md), [terms-mobile-de.md](./terms-mobile-de.md).

Styled pages use the site `main.css` template (header, footer, prose) like [privacy.html](../../../website/en/privacy.html) — not bare inline styles.

---

## After deploy

```bash
curl -sI 'https://nextcloud.software-by-design.de/en/privacy-seacheck-mobile.html' | head -1
curl -sI 'https://nextcloud.software-by-design.de/de/datenschutz-seacheck-mobile.html' | head -1
```

Paste privacy URL into Play Console. In-app links use [src/lib/legal/legalUrls.ts](../../src/lib/legal/legalUrls.ts) (already point at these URLs).

---

## Play Console fields

| Field | Value |
|-------|--------|
| Privacy policy | `https://nextcloud.software-by-design.de/en/privacy-seacheck-mobile.html` |
| Website | `https://software-by-design.de` |
| Email | info@software-by-design.de |
