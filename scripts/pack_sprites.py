#!/usr/bin/env python3
"""
Packs src/assets/images/**.png into dist/sprites.png + dist/sprites.json.

Drop-in replacement for the TexturePacker step in gulpfile.js: it writes the same
"JSON (Hash)" format PixiJS reads, trimming transparent borders and recording
spriteSourceSize/sourceSize so every frame keeps its original size and offset.

Requires Pillow: pip install pillow
Usage: python3 scripts/pack_sprites.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / 'src' / 'assets' / 'images'
OUT_IMAGE = ROOT / 'dist' / 'sprites.png'
OUT_DATA = ROOT / 'dist' / 'sprites.json'

MAX_WIDTH = 1024
# empty pixels between frames so neighbouring sprites never bleed into each other
PADDING = 2


def load_frames():
    frames = []
    for path in sorted(SOURCE_DIR.rglob('*.png')):
        image = Image.open(path).convert('RGBA')
        bbox = image.getbbox() or (0, 0, 1, 1)
        frames.append({
            'name': path.relative_to(SOURCE_DIR).as_posix(),
            'image': image.crop(bbox),
            'source_size': image.size,
            'offset': bbox[:2],
        })
    return frames


def shelf_pack(frames):
    """Places frames left to right in rows (shelves), tallest first."""
    x = y = shelf_height = sheet_width = 0
    for frame in sorted(frames, key=lambda f: (-f['image'].height, f['name'])):
        width, height = frame['image'].size
        if x and x + width > MAX_WIDTH:
            x = 0
            y += shelf_height + PADDING
            shelf_height = 0
        frame['position'] = (x, y)
        x += width + PADDING
        shelf_height = max(shelf_height, height)
        sheet_width = max(sheet_width, x - PADDING)
    return sheet_width, y + shelf_height


def main():
    frames = load_frames()
    width, height = shelf_pack(frames)

    sheet = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    data = {'frames': {}, 'meta': {
        'app': 'scripts/pack_sprites.py',
        'version': '1.0',
        'image': OUT_IMAGE.name,
        'format': 'RGBA8888',
        'size': {'w': width, 'h': height},
        'scale': '1',
    }}

    for frame in sorted(frames, key=lambda f: f['name']):
        image = frame['image']
        x, y = frame['position']
        sheet.paste(image, (x, y))
        source_w, source_h = frame['source_size']
        data['frames'][frame['name']] = {
            'frame': {'x': x, 'y': y, 'w': image.width, 'h': image.height},
            'rotated': False,
            'trimmed': image.size != frame['source_size'],
            'spriteSourceSize': {'x': frame['offset'][0], 'y': frame['offset'][1], 'w': image.width, 'h': image.height},
            'sourceSize': {'w': source_w, 'h': source_h},
        }

    sheet.save(OUT_IMAGE, optimize=True)
    OUT_DATA.write_text(json.dumps(data, indent=2) + '\n')
    print(f'Packed {len(frames)} frames into {OUT_IMAGE.name} ({width}x{height})')


if __name__ == '__main__':
    main()
