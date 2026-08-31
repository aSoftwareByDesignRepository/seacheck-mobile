#!/usr/bin/env python3
"""SeaCheck-branded Play Store phone screenshot placeholders (illustrative until live capture)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/play-store/assets/screenshots"

W, H = 1080, 1920
BG = (11, 22, 34)
SURFACE = (18, 32, 48)
TEXT = (240, 246, 252)
MUTED = (150, 175, 200)
ACCENT = (0, 115, 173)
WARN = (255, 196, 120)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = (
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf"
        if bold
        else "/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf"
    )
    return ImageFont.truetype(path, size)


def base(title: str, subtitle: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, W, 180), fill=SURFACE)
    draw.text((48, 56), title, font=font(48, True), fill=TEXT)
    draw.text((48, 118), subtitle, font=font(26), fill=MUTED)
    draw.rectangle((0, H - 140, W, H), fill=SURFACE)
    for i, label in enumerate(["Map", "Passage", "Downloads", "More"]):
        x = 48 + i * 250
        color = ACCENT if i == 0 else MUTED
        draw.text((x, H - 88), label, font=font(28, True), fill=color)
    return img, draw


def save(img: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    img.save(path, "PNG", optimize=True)
    print(f"Wrote {path}")


def shot_map() -> None:
    img, draw = base("Map", "GPS · COG · SOG")
    draw.rectangle((48, 220, W - 48, H - 200), fill=(20, 55, 90))
    draw.ellipse((480, 760, 560, 840), fill=ACCENT)
    draw.text((48, H - 320), "Depth overlay · OpenSeaMap", font=font(24), fill=MUTED)
    save(img, "phone-01-map.png")


def shot_disclaimer() -> None:
    img, draw = base("Welcome", "Navigation notice")
    draw.rounded_rectangle((48, 260, W - 48, 620), radius=24, fill=SURFACE)
    draw.text((80, 300), "NOT FOR PRIMARY NAVIGATION", font=font(30, True), fill=WARN)
    draw.text((80, 360), "Aid to navigation only. Carry official charts.", font=font(26), fill=TEXT)
    save(img, "phone-02-disclaimer.png")


def shot_passage() -> None:
    img, draw = base("Passage", "Waypoints · legs")
    for y, label in [(280, "WP1 — harbour"), (420, "WP2 — channel"), (560, "WP3 — anchorage")]:
        draw.rounded_rectangle((48, y, W - 48, y + 90), radius=16, fill=SURFACE)
        draw.text((80, y + 28), label, font=font(30), fill=TEXT)
    save(img, "phone-03-passage.png")


def shot_downloads() -> None:
    img, draw = base("Downloads", "Offline packs")
    draw.rounded_rectangle((48, 280, W - 48, 430), radius=20, fill=SURFACE)
    draw.text((80, 320), "Kiel Bay — Ready for offline use", font=font(30, True), fill=TEXT)
    draw.text((80, 370), "OpenSeaMap base + seamarks", font=font(24), fill=MUTED)
    save(img, "phone-04-downloads.png")


def shot_offline() -> None:
    img, draw = base("Map", "Offline mode")
    draw.rounded_rectangle((48, 220, W - 48, 300), radius=16, fill=(40, 70, 40))
    draw.text((80, 248), "Using offline charts", font=font(28, True), fill=(200, 255, 200))
    draw.rectangle((48, 340, W - 48, H - 200), fill=(20, 55, 90))
    save(img, "phone-05-offline.png")


def shot_about() -> None:
    img, draw = base("About", "Legal · attribution")
    for y, label in [(280, "Privacy policy"), (380, "Terms of use"), (480, "OpenSeaMap attribution")]:
        draw.rounded_rectangle((48, y, W - 48, y + 70), radius=14, fill=SURFACE)
        draw.text((80, y + 20), label, font=font(28), fill=TEXT)
    save(img, "phone-06-about.png")


def main() -> None:
    shot_disclaimer()
    shot_map()
    shot_passage()
    shot_downloads()
    shot_offline()
    shot_about()


if __name__ == "__main__":
    main()
