#!/usr/bin/env python3
"""Rasterize the RUSH TIMER mark into the PWA icon set."""

import math
import struct
import zlib
from pathlib import Path

INK = (16, 24, 32, 255)
RUSH = (132, 255, 74, 255)
WHITE = (255, 255, 255, 255)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "icons"


def blend(top, bottom, coverage: float):
    coverage = max(0.0, min(1.0, coverage))
    return tuple(int(top[index] * coverage + bottom[index] * (1 - coverage)) for index in range(4))


def cover_circle(x, y, cx, cy, radius, stroke):
    distance = math.hypot(x - cx, y - cy)
    outer = radius + stroke / 2
    inner = radius - stroke / 2
    if distance > outer + 0.8 or distance < inner - 0.8:
        return 0.0
    if inner + 0.2 <= distance <= outer - 0.2:
        return 1.0
    edge = min(abs(distance - outer), abs(distance - inner))
    return max(0.0, min(1.0, 0.8 - edge))


def cover_segment(x, y, x1, y1, x2, y2, width):
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy) or 1
    t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (length * length)))
    px, py = x1 + dx * t, y1 + dy * t
    distance = math.hypot(x - px, y - py)
    half = width / 2
    if distance >= half + 0.8:
        return 0.0
    if distance <= half - 0.6:
        return 1.0
    return max(0.0, min(1.0, half + 0.4 - distance))


def paint(x, y, size, maskable):
    color = INK
    cx = (size - 1) / 2
    cy = (size - 1) / 2 + size * (0.015 if not maskable else 0.01)
    scale = 0.46 if maskable else 0.62
    radius = size * scale * 0.5
    stroke = max(2.0, size * (0.055 if maskable else 0.072))

    ring = cover_circle(x, y, cx, cy, radius, stroke)
    if ring:
        color = blend(RUSH, color, ring)

    crown_w = stroke * 0.72
    crown_top = cy - radius - stroke * 0.95
    crown_bottom = cy - radius + stroke * 0.15
    if abs(x - cx) <= crown_w / 2 and crown_top <= y <= crown_bottom:
        color = RUSH

    angle = math.radians(42)
    length = radius * 0.62
    x2 = cx + math.sin(angle) * length
    y2 = cy - math.cos(angle) * length
    hand = cover_segment(x, y, cx, cy, x2, y2, stroke * 0.42)
    if hand:
        color = blend(WHITE, color, hand)

    hub = max(0.0, min(1.0, (stroke * 0.46 - math.hypot(x - cx, y - cy)) * 1.4))
    if hub:
        color = blend(RUSH, color, hub)
    return color


def write_png(path: Path, size: int, maskable: bool):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            samples = [paint(x + sx, y + sy, size, maskable) for sy in (0.25, 0.75) for sx in (0.25, 0.75)]
            raw.extend(int(sum(pixel[channel] for pixel in samples) / 4) for channel in range(4))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    write_png(OUT / "icon-192.png", 192, False)
    write_png(OUT / "icon-512.png", 512, False)
    write_png(OUT / "icon-maskable-192.png", 192, True)
    write_png(OUT / "icon-maskable-512.png", 512, True)
    write_png(OUT / "apple-touch-icon.png", 180, False)
    print(f"wrote icons to {OUT}")


if __name__ == "__main__":
    main()
