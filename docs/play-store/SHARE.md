# Sharing SeaCheck (not launching)

SeaCheck is a **personal tool** shared as-is — not a product launch for Software by Design.

Goal: someone on a small boat might find it useful alongside **paper charts** (SOG, coords, quick position on deck). If support or hassle grows, **pull it from the store**.

---

## Recommended: unlisted on Google Play

Best fit for “share my work” without marketing:

1. Complete the usual Play setup (privacy URL, data safety, AAB) — see [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md).
2. Release to **Production** but set visibility to **Unlisted** (Play Console → Store presence → **Unlisted app**).
3. Only people with the **direct link** can install. No store search, no browse discovery.
4. Share the link where you want (forum, club, friends) — no campaign, no feature graphic push.

You still need legal pages and honest disclaimers; you skip ASO, ads, and “launch” noise.

**Alternative:** **Closed testing** track with a tester list — even smaller audience, more admin per invite.

---

## Store copy tone

Use [LISTING-en.txt](./LISTING-en.txt) / [LISTING-de.txt](./LISTING-de.txt) — written as *shared personal project*, not corporate product.

Optional: skip feature graphic polish; minimum screenshots + icon are enough.

Do **not** link from software-by-design.de homepage or Nextcloud app pages (legal HTML in `website/` stays unlisted).

---

## If it gets too complicated — pull it down

| Action | Effect |
|--------|--------|
| **Unpublish** (Play Console → stop serving new installs) | Link stops working for new users; existing installs keep app until they uninstall |
| **Full removal** | Request app removal after unpublish; takes time, may retain policy records |
| **Ignore reviews** | Valid for as-is share; optionally one pinned “no support guarantee” reply |

You are not obligated to fix every chart gap or answer every mail. Free + as-is + clear disclaimer sets that expectation.

---

## What you still need (minimal)

- [ ] Deploy `website/` legal pages (privacy + terms)
- [ ] `npm run play:preflight`
- [ ] One production AAB (`eas build`)
- [ ] Play Console: unlisted + paste listing + data safety
- [ ] Share link only where you choose

---

## What you can skip

- Feature graphic campaign, promo video, blog launch post
- Website marketing, SEO, sitemap entries for SeaCheck
- Paid ads, press, “new from Software by Design”
- iOS (unless you want Apple hassle for the same small audience)

---

## Liability framing (not legal advice)

You’ve already got: onboarding disclaimer, Settings → About, terms page, map attribution, “not for primary navigation.”

Sharing **free** and **unlisted** with honest copy is a reasonable balance for a hobby tool — not zero risk, but aligned with how you actually use it on your boat.
