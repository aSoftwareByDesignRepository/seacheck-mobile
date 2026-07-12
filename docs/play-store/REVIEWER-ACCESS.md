# Google Play — reviewer access

SeaCheck does **not** require login or a backend server. Reviewers can use the app immediately after install.

---

## App access (Play Console → App content → App access)

| Question | Answer |
|----------|--------|
| Does your app restrict access to features using credentials? | **No** |
| All functionality available without special access? | **Yes** |

**Instructions for reviewers (paste into “Instructions” field):**

```
SeaCheck is a standalone navigation app — no account or server required.

1. Install and open the app.
2. On first launch, read the navigation disclaimer and tap “I understand — continue”.
3. Grant location when prompted (foreground is enough to test the map; background is optional).
4. On Android, acknowledge battery guidance (or skip).
5. Tap “Open SeaCheck” on the final onboarding step.

To test offline charts:
• Connect to Wi‑Fi.
• Open Downloads → download “Kieler Bucht (test)”.
• Wait for “Ready for offline use”.
• Enable airplane mode → Map still shows cached charts in the Kiel area.

To test anchor alarm (optional):
• Settings → enable background location and notifications.
• Map → set Anchor alarm at current position.

Support: info@software-by-design.de
```

---

## Review notes (optional)

- **Not a certified chart plotter** — disclaimer shown at onboarding and in Settings → About.
- **No ads, no analytics SDKs.**
- **Location** is core to the product (GPS chart).
- **Background location** is optional; used for anchor watch and track recording.

---

## Demo credentials

**Not required** — leave blank.

---

## Support during review

Monitor **info@software-by-design.de** while the app is in review.
