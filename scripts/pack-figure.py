#!/usr/bin/env python3
"""Shrink a generated GLB's textures so it can be shipped in a web app.

The generators hand back 4096×4096 maps — three of them per figure, which is
2.6 MB for one man. A figure in this app is 1.7 m tall and is looked at from a
metre or two away inside a hull three hundred cubits long; 4K of base colour is
detail no reader can ever see, paid for on every phone that opens the page.

So: the base colour keeps enough resolution for a FACE (that is the part a
reader walks up to), and the maps that only shape the light are halved again.
Nothing else in the file is touched — same mesh, same UVs, same material.

    python3 scripts/pack-figure.py in.glb out.glb [--colour 2048] [--maps 1024]

It prints the before and after so the saving is a measured number and not a
claim.
"""
import json
import struct
import sys
from io import BytesIO
from PIL import Image

JSON_CHUNK, BIN_CHUNK = 0x4E4F534A, 0x004E4942


def read_glb(path):
    d = open(path, 'rb').read()
    assert d[:4] == b'glTF', f'{path} is not a GLB'
    total = struct.unpack('<I', d[8:12])[0]
    off, js, bin_ = 12, None, b''
    while off < total:
        length, kind = struct.unpack('<II', d[off:off + 8])
        body = d[off + 8:off + 8 + length]
        if kind == JSON_CHUNK:
            js = json.loads(body)
        elif kind == BIN_CHUNK:
            bin_ = body
        off += 8 + length
    return js, bin_


def write_glb(path, js, bin_):
    jb = json.dumps(js, separators=(',', ':')).encode()
    jb += b' ' * (-len(jb) % 4)
    bb = bin_ + b'\0' * (-len(bin_) % 4)
    total = 12 + 8 + len(jb) + 8 + len(bb)
    with open(path, 'wb') as f:
        f.write(b'glTF' + struct.pack('<II', 2, total))
        f.write(struct.pack('<II', len(jb), JSON_CHUNK) + jb)
        f.write(struct.pack('<II', len(bb), BIN_CHUNK) + bb)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    args = sys.argv[3:]
    colour = int(args[args.index('--colour') + 1]) if '--colour' in args else 2048
    maps = int(args[args.index('--maps') + 1]) if '--maps' in args else 1024

    js, bin_ = read_glb(src)
    views = js.get('bufferViews', [])

    # Which image is the base colour: the one a material points its
    # baseColorTexture at. It is the only map a reader looks AT rather than
    # through, so it is the only one that keeps the larger size.
    base = set()
    for m in js.get('materials', []):
        t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if t is not None:
            base.add(js['textures'][t['index']]['source'])

    new_blobs = {}
    for i, img in enumerate(js.get('images', [])):
        if 'bufferView' not in img:
            continue
        bv = views[img['bufferView']]
        raw = bin_[bv['byteOffset']:bv['byteOffset'] + bv['byteLength']]
        im = Image.open(BytesIO(raw))
        cap = colour if i in base else maps
        if max(im.size) > cap:
            im = im.resize((cap, cap), Image.LANCZOS)
        buf = BytesIO()
        im.convert('RGB').save(buf, 'JPEG', quality=88, optimize=True)
        new_blobs[img['bufferView']] = buf.getvalue()
        img['mimeType'] = 'image/jpeg'
        print(f'  image {i}: {len(raw) // 1024} kB -> {len(buf.getvalue()) // 1024} kB'
              f'  ({"base colour" if i in base else "map"}, {cap}px)')

    # Rebuild the binary chunk, keeping every view's bytes but at new offsets.
    out = bytearray()
    for k, bv in enumerate(views):
        blob = new_blobs.get(k, bin_[bv['byteOffset']:bv['byteOffset'] + bv['byteLength']])
        out += b'\0' * (-len(out) % 4)
        bv['byteOffset'] = len(out)
        bv['byteLength'] = len(blob)
        out += blob
    js['buffers'][0]['byteLength'] = len(out)
    write_glb(dst, js, bytes(out))

    a, b = len(open(src, 'rb').read()), len(open(dst, 'rb').read())
    print(f'{src} {a // 1024} kB -> {dst} {b // 1024} kB  ({100 - b * 100 // a}% smaller)')


if __name__ == '__main__':
    main()
