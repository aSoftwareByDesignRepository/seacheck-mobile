#!/usr/bin/env python3
"""SeaCheck App Store screenshot series (iPhone 6.5″ + iPad 13″).

Frames Play phone placeholders (or live captures under docs/app-store/assets/captures/)
into App Store Connect slot sizes with a stable maritime stage so carousel swipes do not jump.

Upload:
  iphone-65-01…06.png  → 1284×2778 (iPhone 6.5″)
  ipad-13-01…06.png    → 2064×2752 (iPad 13″)

Optional masters:
  iphone-69-01…06.png  → 1320×2868
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs/app-store/assets"
CAPTURES = ASSETS / "captures"
PLAY = ROOT / "docs/play-store/assets/screenshots"

# SeaCheck maritime palette (not AZC Nextcloud blue / clock motif)
DEEP = (8, 28, 48)
TEAL = (12, 72, 96)
ACCENT = (0, 140, 168)
FOAM = (220, 240, 248)
WHITE = (255, 255, 255)
MUTED = (168, 200, 214)
BEZEL = (18, 24, 32)

KICKER = "OFFLINE CHARTS  ·  NO ACCOUNT"


@dataclass(frozen=True)
class StageSpec:
    key: str
    w: int
    h: int
    type_x: int
    kicker_y: int
    kicker_size: int
    headline_size: int
    sub_size: int
    frame_w: int
    bezel: int
    radius_outer: int
    radius_inner: int
    device_top: int


IPHONE65 = StageSpec(
    key="iphone-65",
    w=1284,
    h=2778,
    type_x=72,
    kicker_y=88,
    kicker_size=30,
    headline_size=78,
    sub_size=36,
    frame_w=920,
    bezel=18,
    radius_outer=78,
    radius_inner=62,
    device_top=720,
)

IPHONE69 = StageSpec(
    key="iphone-69",
    w=1320,
    h=2868,
    type_x=80,
    kicker_y=96,
    kicker_size=32,
    headline_size=84,
    sub_size=38,
    frame_w=960,
    bezel=20,
    radius_outer=84,
    radius_inner=66,
    device_top=760,
)

IPAD = StageSpec(
    key="ipad-13",
    w=2064,
    h=2752,
    type_x=120,
    kicker_y=100,
    kicker_size=36,
    headline_size=96,
    sub_size=42,
    frame_w=1480,
    bezel=16,
    radius_outer=40,
    radius_inner=28,
    device_top=680,
)


@dataclass(frozen=True)
class Shot:
    slug: str
    play_name: str
    title: tuple[str, str]
    subtitle: tuple[str, str]


SHOTS: tuple[Shot, ...] = (
    Shot("01", "phone-01-map.png", ("GPS on chart.", "Deck-side."), ("COG · SOG · bearing", "on OpenSeaMap.")),
    Shot("02", "phone-02-disclaimer.png", ("Aid only.", "Not ECDIS."), ("Carry official charts.", "Volunteer map data.")),
    Shot("03", "phone-03-passage.png", ("Sketch the", "passage."), ("Waypoints, legs,", "GPX when you need it.")),
    Shot("04", "phone-04-downloads.png", ("Download on", "Wi‑Fi."), ("Offline packs ready", "underway.")),
    Shot("05", "phone-05-offline.png", ("Charts work", "without signal."), ("Base + seamarks", "sealed on device.")),
    Shot("06", "phone-06-about.png", ("No ads.", "No account."), ("Privacy & terms", "in Settings → About.")),
)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = (
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf" if bold else "/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    )
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def gradient_bg(stage: StageSpec) -> Image.Image:
    img = Image.new("RGB", (stage.w, stage.h))
    px = img.load()
    for y in range(stage.h):
        ty = y / max(1, stage.h - 1)
        for x in range(stage.w):
            tx = x / max(1, stage.w - 1)
            t = ty * 0.75 + tx * 0.15
            r = int(TEAL[0] + (DEEP[0] - TEAL[0]) * t)
            g = int(TEAL[1] + (DEEP[1] - TEAL[1]) * t)
            b = int(TEAL[2] + (DEEP[2] - TEAL[2]) * t)
            # soft horizon glow
            glow = max(0.0, 1.0 - ((tx - 0.55) ** 2 * 6 + (ty - 0.2) ** 2 * 10))
            r = min(255, int(r + ACCENT[0] * 0.12 * glow))
            g = min(255, int(g + ACCENT[1] * 0.10 * glow))
            b = min(255, int(b + ACCENT[2] * 0.14 * glow))
            px[x, y] = (r, g, b)
    return img


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def load_device_content(shot: Shot, frame_inner: tuple[int, int]) -> Image.Image:
    capture = CAPTURES / f"iphone-69-{shot.slug}-{shot.play_name.replace('phone-', '').replace('.png', '')}.png"
    # Prefer explicit captures; fall back to Play placeholders.
    candidates = [
        CAPTURES / f"iphone-69-{shot.slug}.png",
        CAPTURES / shot.play_name,
        PLAY / shot.play_name,
    ]
    src_path = next((p for p in candidates if p.exists()), None)
    if src_path is None:
        raise FileNotFoundError(f"Missing capture/placeholder for {shot.slug}: tried {candidates}")
    src = Image.open(src_path).convert("RGB")
    tw, th = frame_inner
    sw, sh = src.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return resized.crop((left, top, left + tw, top + th))


def compose(stage: StageSpec, shot: Shot) -> Image.Image:
    base = gradient_bg(stage)
    draw = ImageDraw.Draw(base)
    kicker_f = font(stage.kicker_size, bold=True)
    head_f = font(stage.headline_size, bold=True)
    sub_f = font(stage.sub_size, bold=False)

    draw.text((stage.type_x, stage.kicker_y), KICKER, font=kicker_f, fill=MUTED)
    y = stage.kicker_y + stage.kicker_size + 36
    for line in shot.title:
        draw.text((stage.type_x, y), line, font=head_f, fill=WHITE)
        y += int(stage.headline_size * 0.95)
    y += 36
    for line in shot.subtitle:
        draw.text((stage.type_x, y), line, font=sub_f, fill=FOAM)
        y += int(stage.sub_size * 1.35)

    aspect = 19.5 / 9 if stage.key.startswith("iphone") else 4 / 3
    frame_h = int(stage.frame_w * aspect)
    if stage.key == "ipad-13":
        frame_h = int(stage.frame_w * 1.333)

    max_h = stage.h - stage.device_top - 80
    if frame_h > max_h:
        scale = max_h / frame_h
        frame_w = int(stage.frame_w * scale)
        frame_h = int(frame_h * scale)
    else:
        frame_w = stage.frame_w

    ox = (stage.w - frame_w) // 2
    oy = stage.device_top
    outer = Image.new("RGBA", (frame_w, frame_h), (*BEZEL, 255))
    outer.putalpha(rounded_mask((frame_w, frame_h), stage.radius_outer))

    inner_w = frame_w - stage.bezel * 2
    inner_h = frame_h - stage.bezel * 2
    content = load_device_content(shot, (inner_w, inner_h)).convert("RGBA")
    content.putalpha(rounded_mask((inner_w, inner_h), stage.radius_inner))

    device = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    device.alpha_composite(outer, (0, 0))
    device.alpha_composite(content, (stage.bezel, stage.bezel))

    out = base.convert("RGBA")
    out.alpha_composite(device, (ox, oy))
    return out.convert("RGB")


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    CAPTURES.mkdir(parents=True, exist_ok=True)

    for shot in SHOTS:
        for stage in (IPHONE65, IPHONE69, IPAD):
            img = compose(stage, shot)
            path = ASSETS / f"{stage.key}-{shot.slug}.png"
            img.save(path, "PNG", optimize=True)
            print(f"Wrote {path} ({img.size[0]}×{img.size[1]})")

    print("Done. Upload iphone-65-* and ipad-13-* to App Store Connect.")


if __name__ == "__main__":
    main()
