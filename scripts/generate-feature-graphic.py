#!/usr/bin/env python3
"""Generate Google Play feature graphic (1024x500) for SeaCheck."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/play-store/assets/feature-graphic-1024x500.png"
ICON = ROOT / "assets/icon.png"

W, H = 1024, 500

# Brand palette
NAVY = (11, 22, 34)
DEEP = (11, 37, 56)
TEAL = (13, 90, 122)
ACCENT = (0, 115, 173)
ACCENT_LIGHT = (77, 171, 247)
WHITE = (255, 255, 255)
TEXT_MUTED = (168, 196, 216)


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def gradient_bg() -> Image.Image:
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        for x in range(W):
            # Diagonal maritime gradient
            t = (x / (W - 1) * 0.35 + y / (H - 1) * 0.65)
            r = lerp(TEAL[0], NAVY[0], t)
            g = lerp(TEAL[1], NAVY[1], t)
            b = lerp(TEAL[2], NAVY[2], t)
            # Soft vignette
            cx, cy = (x - W * 0.42) / W, (y - H * 0.5) / H
            vignette = 1.0 - 0.22 * (cx * cx + cy * cy)
            px[x, y] = (
                max(0, min(255, int(r * vignette))),
                max(0, min(255, int(g * vignette))),
                max(0, min(255, int(b * vignette))),
            )
    return img


def add_chart_texture(base: Image.Image) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    # Faint chart grid — far right margin only
    for y in range(50, H - 40, 64):
        draw.line([(760, y), (W - 20, y)], fill=(255, 255, 255, 12), width=1)
    for x in range(800, W - 20, 80):
        draw.line([(x, 40), (x, H - 40)], fill=(255, 255, 255, 8), width=1)

    # Compass tick ring — decorative, far right (away from text)
    cx, cy, r = 930, 250, 100
    for deg in range(0, 360, 15):
        rad = math.radians(deg - 90)
        inner = r - (10 if deg % 45 == 0 else 5)
        x0 = cx + math.cos(rad) * inner
        y0 = cy + math.sin(rad) * inner
        x1 = cx + math.cos(rad) * r
        y1 = cy + math.sin(rad) * r
        alpha = 40 if deg % 45 == 0 else 18
        draw.line([(x0, y0), (x1, y1)], fill=(255, 255, 255, alpha), width=2 if deg % 45 == 0 else 1)

    # Subtle depth contours along bottom edge
    for i, y_off in enumerate([455, 475]):
        alpha = 22 - i * 6
        pts = []
        for x in range(430, W, 6):
            wave = math.sin((x - 430) * 0.015 + i * 1.2) * 10
            pts.append((x, y_off + wave))
        draw.line(pts, fill=(77, 171, 247, alpha), width=2, joint="curve")

    # Soft radial glow behind icon area
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((10, 50, 430, 470), fill=(0, 115, 173, 42))
    glow = glow.filter(ImageFilter.GaussianBlur(32))
    layer = Image.alpha_composite(layer, glow)

    # Top-left light wash
    wash = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wdraw = ImageDraw.Draw(wash)
    wdraw.ellipse((-120, -160, 520, 360), fill=(77, 171, 247, 22))
    wash = wash.filter(ImageFilter.GaussianBlur(40))
    layer = Image.alpha_composite(layer, wash)

    return Image.alpha_composite(base.convert("RGBA"), layer)


# App icon corner radius (brand-mark: rx=52 on 224px tile)
ICON_CORNER_RATIO = 52 / 224


def icon_corner_radius(size: int) -> int:
    return max(12, int(size * ICON_CORNER_RATIO))


def rounded_icon_mask(size: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size, size),
        radius=icon_corner_radius(size),
        fill=255,
    )
    return mask


def add_text_scrim(base: Image.Image) -> Image.Image:
    """Soft fade behind the text zone — not a visible box."""
    scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = scrim.load()
    for y in range(H):
        for x in range(400, W):
            t = ((x - 400) / (W - 400)) ** 1.4
            vy = 1.0 - 0.35 * ((y - H / 2) / (H / 2)) ** 2
            alpha = int(55 * t * vy)
            if alpha:
                px[x, y] = (4, 12, 22, alpha)
    return Image.alpha_composite(base, scrim)


def draw_text_with_shadow(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    shadow: tuple[int, int, int, int] = (4, 14, 26, 140),
    offsets: tuple[tuple[int, int], ...] = ((0, 2), (0, 4), (1, 3)),
) -> None:
    x, y = xy
    for ox, oy in offsets:
        draw.text((x + ox, y + oy), text, font=font, fill=shadow)
    draw.text(xy, text, font=font, fill=fill)


def add_typography(base: Image.Image, fonts: dict[str, ImageFont.FreeTypeFont]) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    title = "SeaCheck"
    sub = "Offline coastal navigation"

    tx = 458
    # Vertically center title + subline block
    title_bbox = draw.textbbox((0, 0), title, font=fonts["title"])
    sub_bbox = draw.textbbox((0, 0), sub, font=fonts["sub"])
    block_h = (title_bbox[3] - title_bbox[1]) + 46 + (sub_bbox[3] - sub_bbox[1])
    ty = (H - block_h) // 2

    draw_text_with_shadow(draw, (tx, ty), title, fonts["title"], (*WHITE, 255))

    bbox = draw.textbbox((tx, ty), title, font=fonts["title"])
    accent_y = bbox[3] + 16
    draw.rounded_rectangle(
        (tx, accent_y, tx + 120, accent_y + 4),
        radius=2,
        fill=(*ACCENT_LIGHT, 255),
    )

    sub_y = accent_y + 30
    draw.text((tx, sub_y), sub, font=fonts["sub"], fill=(*TEXT_MUTED, 235))

    # Editorial accent — thin vertical rule, not a box
    rule_top = ty + 8
    rule_bottom = sub_y + (sub_bbox[3] - sub_bbox[1]) - 4
    draw.rounded_rectangle(
        (tx - 28, rule_top, tx - 24, rule_bottom),
        radius=2,
        fill=(*ACCENT_LIGHT, 200),
    )

    return Image.alpha_composite(base, layer)


def add_icon(base: Image.Image) -> Image.Image:
    icon = Image.open(ICON).convert("RGBA")
    size = 340
    icon = icon.resize((size, size), Image.LANCZOS)
    mask = rounded_icon_mask(size)

    # Clip icon to match launcher / brand-mark rounded square
    clipped = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    clipped.paste(icon, (0, 0), mask)

    # Drop shadow follows the same rounded shape
    shadow = Image.new("RGBA", (size + 80, size + 80), (0, 0, 0, 0))
    shadow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 170))
    shadow.paste(shadow_layer, (40, 48), mask)
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ix, iy = 58, (H - size) // 2
    layer.paste(shadow, (ix - 20, iy - 8), shadow)
    layer.paste(clipped, (ix, iy), clipped)
    return Image.alpha_composite(base, layer)


def main() -> None:
    fonts = {
        "title": ImageFont.truetype("/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf", 82),
        "sub": ImageFont.truetype("/usr/share/fonts/truetype/ubuntu/Ubuntu-L.ttf", 34),
    }

    img = gradient_bg().convert("RGBA")
    img = add_chart_texture(img)
    img = add_text_scrim(img)
    img = add_typography(img, fonts)
    img = add_icon(img)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
