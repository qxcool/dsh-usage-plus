"""Redact sensitive regions from README screenshots.

Run after replacing the raw captures under docs/screenshots/:
  python scripts/redact-screenshots.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / 'docs' / 'screenshots'


def blur_box(im: Image.Image, box: tuple[float, float, float, float], radius: int = 16) -> None:
  left, top, right, bottom = (int(v) for v in box)
  left = max(0, left)
  top = max(0, top)
  right = min(im.width, right)
  bottom = min(im.height, bottom)
  if right <= left or bottom <= top:
    return
  crop = im.crop((left, top, right, bottom))
  for _ in range(4):
    crop = crop.filter(ImageFilter.GaussianBlur(radius=radius))
  im.paste(crop, (left, top))


def redact_settings(path: Path) -> None:
  im = Image.open(path).convert('RGB')
  w, h = im.size
  # Outer project/workspace rail (left of settings modal).
  blur_box(im, (0, h * 0.05, w * 0.145, h * 0.95), radius=26)
  # Header model/route id under the usage tabs.
  blur_box(im, (w * 0.34, h * 0.108, w * 0.80, h * 0.148), radius=12)
  # Balance currency amount only.
  blur_box(im, (w * 0.68, h * 0.788, w * 0.92, h * 0.838), radius=14)
  im.save(path, optimize=True)
  print(f'redacted {path.name} ({w}x{h})')


def redact_composer(path: Path) -> None:
  im = Image.open(path).convert('RGB')
  w, h = im.size
  # Thin chat band above the plan card.
  blur_box(im, (0, 0, w, h * 0.12), radius=24)
  # Far-right chat fragment beside the card.
  blur_box(im, (w * 0.82, h * 0.12, w, h * 0.55), radius=18)
  # Tiny bottom-right status chip only.
  blur_box(im, (w * 0.78, h * 0.88, w, h), radius=12)
  im.save(path, optimize=True)
  print(f'redacted {path.name} ({w}x{h})')


def main() -> None:
  redact_composer(ROOT / 'composer-plan-strip.png')
  redact_settings(ROOT / 'settings-overview.png')


if __name__ == '__main__':
  main()
