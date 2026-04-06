#!/usr/bin/env python3
"""
Generate placeholder app icons for all Android mipmap densities.
Replace with your real icon before production release.

Requirements: pip install Pillow
Usage: python scripts/generate-icons.py
"""
import os
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Install Pillow first: pip install Pillow")
    raise

# Android mipmap densities and their icon sizes
DENSITIES = {
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi":  144,
    "mipmap-xxxhdpi": 192,
}

ANDROID_RES = Path(__file__).parent.parent / "android" / "app" / "src" / "main" / "res"
BG_COLOR    = (79, 70, 229)   # #4f46e5 — primary brand color
FG_COLOR    = (255, 255, 255)

def make_icon(size: int) -> Image.Image:
    img  = Image.new("RGBA", (size, size), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Draw a simple magnifying glass shape
    cx, cy = size // 2, size // 2
    r      = int(size * 0.28)
    lw     = max(2, size // 20)

    # Circle
    draw.ellipse(
        [cx - r, cy - r - size // 10, cx + r, cy + r - size // 10],
        outline=FG_COLOR, width=lw,
    )
    # Handle
    offset = int(r * 0.7)
    draw.line(
        [cx + offset, cy + offset - size // 10,
         cx + offset + int(r * 0.6), cy + offset + int(r * 0.6) - size // 10],
        fill=FG_COLOR, width=lw,
    )
    return img

def make_round_icon(size: int) -> Image.Image:
    """Circular icon for ic_launcher_round"""
    img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    draw_mask = ImageDraw.Draw(mask)
    draw_mask.ellipse([0, 0, size, size], fill=255)

    bg = Image.new("RGBA", (size, size), BG_COLOR)
    img.paste(bg, mask=mask)

    draw = ImageDraw.Draw(img)
    cx, cy = size // 2, size // 2
    r      = int(size * 0.28)
    lw     = max(2, size // 20)
    draw.ellipse(
        [cx - r, cy - r - size // 10, cx + r, cy + r - size // 10],
        outline=FG_COLOR, width=lw,
    )
    offset = int(r * 0.7)
    draw.line(
        [cx + offset, cy + offset - size // 10,
         cx + offset + int(r * 0.6), cy + offset + int(r * 0.6) - size // 10],
        fill=FG_COLOR, width=lw,
    )
    return img

for density, size in DENSITIES.items():
    out_dir = ANDROID_RES / density
    out_dir.mkdir(parents=True, exist_ok=True)

    make_icon(size).save(out_dir / "ic_launcher.png")
    make_round_icon(size).save(out_dir / "ic_launcher_round.png")
    print(f"✓ {density} ({size}×{size})")

print("\nDone. Replace with your real icon before release.")
print("Recommended tool: https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html")
