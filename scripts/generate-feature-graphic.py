#!/usr/bin/env python3
"""Generate Google Play feature graphic (1024x500) for SeaCheck Mobile."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/play-store/assets/feature-graphic-1024x500.png"
ICON = ROOT / "assets/icon.png"

W, H = 1024, 500
NAVY = (11, 22, 34)  # #0b1622
DEEP = (0, 45, 72)
ACCENT = (0, 115, 173)  # #0073ad
WHITE = (255, 255, 255)
MUTED = (180, 205, 225)


def gradient_bg() -> Image.Image:
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        for x in range(W):
            t = x / (W - 1) * 0.25 + y / (H - 1) * 0.75
            r = int(NAVY[0] + (DEEP[0] - NAVY[0]) * t)
            g = int(NAVY[1] + (DEEP[1] - NAVY[1]) * t)
            b = int(NAVY[2] + (DEEP[2] - NAVY[2]) * t)
            px[x, y] = (r, g, b)
    return img


def add_waves(base: Image.Image) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for i, y_off in enumerate([360, 400, 440]):
        alpha = 28 - i * 6
        pts = []
        for x in range(0, W, 8):
            wave = math.sin((x + i * 40) * 0.012) * 10
            pts.append((x, y_off + wave))
        draw.line(pts, fill=(*ACCENT, alpha), width=3, joint="curve")
    return Image.alpha_composite(base.convert("RGBA"), layer)


def add_icon(base: Image.Image) -> Image.Image:
    icon = Image.open(ICON).convert("RGBA").resize((300, 300), Image.LANCZOS)
    mask = Image.new("L", (300, 300), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 300, 300), radius=48, fill=255)
    clipped = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
    clipped.paste(icon, (0, 0), mask)
    shadow = Image.new("RGBA", (360, 360), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((30, 34, 330, 334), radius=48, fill=(0, 0, 0, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ix, iy = 72, (H - 300) // 2
    layer.paste(shadow, (ix - 18, iy - 6), shadow)
    layer.paste(clipped, (ix, iy), clipped)
    return Image.alpha_composite(base, layer)


def add_text(base: Image.Image) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    title_font = ImageFont.truetype("/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf", 68)
    sub_font = ImageFont.truetype("/usr/share/fonts/truetype/ubuntu/Ubuntu-L.ttf", 30)
    tag_font = ImageFont.truetype("/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf", 22)
    tx = 420
    ty = 150
    draw.text((tx + 2, ty + 2), "SeaCheck", font=title_font, fill=(0, 0, 0, 120))
    draw.text((tx, ty), "SeaCheck", font=title_font, fill=(*WHITE, 255))
    draw.text((tx, ty + 88), "Offline coastal navigation", font=sub_font, fill=(*MUTED, 240))
    draw.text((tx, ty + 140), "Aid to navigation — not official charts", font=tag_font, fill=(*ACCENT, 220))
    draw.rounded_rectangle((tx - 20, ty + 8, tx - 16, ty + 170), radius=2, fill=(*ACCENT, 200))
    return Image.alpha_composite(base, layer)


def main() -> None:
    img = gradient_bg().convert("RGBA")
    img = add_waves(img)
    img = add_text(img)
    img = add_icon(img)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
