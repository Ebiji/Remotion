#!/usr/bin/env python3
"""花×フラクタルの縦型画像を、外部AI無しでローカルに描画する。

例:
  python3 render_fractal_flower.py --scene tree --seed 3 --out out/tree_3.png
  python3 render_fractal_flower.py --scene all --count 4 --outdir out
シーン: kaleido(黒背景の万華鏡) / tree(青空の虹色の樹) / mandala(曼荼羅+虹) / field(花畑マクロ)
依存: numpy, Pillow
"""
import argparse
import colorsys
import math
import os
import random

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

W, H = 1080, 1920
SS = 2  # スーパーサンプリング倍率


def hsv(h, s=1.0, v=1.0, a=255):
    r, g, b = colorsys.hsv_to_rgb(h % 1.0, s, v)
    return (int(r * 255), int(g * 255), int(b * 255), a)


def vgrad(top, bottom, w, h):
    t = np.linspace(0, 1, h)[:, None, None]
    top = np.array(top[:3], float)[None, None, :]
    bottom = np.array(bottom[:3], float)[None, None, :]
    arr = (top * (1 - t) + bottom * t) * np.ones((h, w, 1))
    return Image.fromarray(arr.astype("uint8"), "RGB").convert("RGBA")


def rot(px, py, cx, cy, ang):
    c, s = math.cos(ang), math.sin(ang)
    return cx + (px - cx) * c - (py - cy) * s, cy + (px - cx) * s + (py - cy) * c


def petal_poly(cx, cy, r, ang, width, n=18):
    """花弁(しずく形)の多角形。根元が中心。"""
    pts = []
    for i in range(n + 1):
        t = i / n
        d = r * t
        wv = width * math.sin(math.pi * t ** 0.62) * (1 - 0.15 * t)
        pts.append((cx + d, cy + wv))
    for i in range(n, -1, -1):
        t = i / n
        d = r * t
        wv = width * math.sin(math.pi * t ** 0.62) * (1 - 0.15 * t)
        pts.append((cx + d, cy - wv))
    return [rot(px, py, cx, cy, ang) for px, py in pts]


def flower(d, cx, cy, r, rng, hue0=None, petals=None, drops=True):
    """虹グラデの花弁を放射状に重ねて描く。"""
    hue0 = rng.random() if hue0 is None else hue0
    petals = petals or rng.choice([8, 10, 12, 14])
    a0 = rng.random() * math.tau
    for layer in range(3):  # 外→内
        k = 1 - layer * 0.28
        for i in range(petals):
            ang = a0 + math.tau * i / petals + layer * math.pi / petals
            h = hue0 + 0.18 * layer + 0.02 * math.sin(i)
            for step in range(4):  # 入れ子: 先端(外)→根元(内)で色相と明るさを変える
                f = 1 - step * 0.2
                poly = petal_poly(cx, cy, r * k * f, ang, r * k * (0.34 + 0.06 * layer) * f)
                d.polygon(poly, fill=hsv(h + 0.07 * step, 0.95 - 0.12 * step, 1.0 - 0.05 * step))
            tip = rot(cx + r * k * 0.8, cy, cx, cy, ang)
            mid = rot(cx + r * k * 0.25, cy, cx, cy, ang)
            d.line([mid, tip], fill=hsv(h + 0.3, 0.4, 1.0, 120), width=max(1, int(r * 0.015)))
    d.ellipse([cx - r * 0.2, cy - r * 0.2, cx + r * 0.2, cy + r * 0.2], fill=hsv(0.13, 0.95, 1.0))
    d.ellipse([cx - r * 0.1, cy - r * 0.1, cx + r * 0.1, cy + r * 0.1], fill=hsv(0.06, 1.0, 0.8))
    if drops:
        for _ in range(rng.randint(2, 5)):
            a = rng.random() * math.tau
            dd = r * rng.uniform(0.35, 0.85)
            droplet(d, cx + dd * math.cos(a), cy + dd * math.sin(a), r * rng.uniform(0.05, 0.1))


def droplet(d, x, y, r):
    d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 70), outline=(255, 255, 255, 170), width=max(1, int(r * 0.12)))
    d.ellipse([x - r * 0.55, y - r * 0.6, x - r * 0.1, y - r * 0.2], fill=(255, 255, 255, 230))


def sphere(d, x, y, r, hue, dots=True):
    d.ellipse([x - r, y - r, x + r, y + r], fill=hsv(hue, 0.55, 1.0))
    if dots:
        for i in range(9):
            a = i * 2.4
            rr = r * 0.7 * math.sqrt((i + 1) / 9)
            d.ellipse([x + rr * math.cos(a) - r * 0.1, y + rr * math.sin(a) - r * 0.1,
                       x + rr * math.cos(a) + r * 0.1, y + rr * math.sin(a) + r * 0.1], fill=(255, 255, 255, 235))
    d.ellipse([x - r * 0.6, y - r * 0.7, x - r * 0.2, y - r * 0.3], fill=(255, 255, 255, 120))


def branch(d, x, y, ang, length, width, depth, rng, hue, flowers_at, maxdepth, spread=0.55):
    """再帰的に枝分かれ。先端と中間に花を咲かせる。"""
    if depth > maxdepth or length < 6:
        return
    bend = rng.uniform(-0.25, 0.25)
    pts = [(x, y)]
    n = 8
    a = ang
    for i in range(n):
        a += bend / n
        x += math.cos(a) * length / n
        y += math.sin(a) * length / n
        pts.append((x, y))
    for i in range(n):
        h = hue + 0.06 * depth + 0.03 * i / n
        d.line([pts[i], pts[i + 1]], fill=hsv(h, 0.85, 1.0), width=max(1, int(width)))
        d.line([pts[i], pts[i + 1]], fill=hsv(h + 0.1, 0.4, 1.0, 160), width=max(1, int(width * 0.3)))
    if depth >= maxdepth - 1 or (depth >= 2 and rng.random() < 0.3):
        flowers_at.append((x, y, max(14, length * 0.55), hue + 0.12 * depth))
    k = rng.choice([2, 2, 3])
    for j in range(k):
        off = (j - (k - 1) / 2) * spread + rng.uniform(-0.1, 0.1)
        branch(d, x, y, a + off, length * rng.uniform(0.66, 0.78), width * 0.72, depth + 1, rng, hue, flowers_at, maxdepth, spread)


def paisley(d, x, y, s, ang, col, w=3):
    pts = []
    for i in range(0, 41):
        t = i / 40 * math.pi * 1.35
        r = s * (1 - 0.65 * i / 40)
        pts.append((x + r * math.sin(t) * 0.9, y - r * (1 - math.cos(t)) * 0.9 + s * 0.2 * i / 40))
    pts = [rot(px, py, x, y, ang) for px, py in pts]
    d.line(pts, fill=col, width=w)
    d.ellipse([pts[0][0] - s * .08, pts[0][1] - s * .08, pts[0][0] + s * .08, pts[0][1] + s * .08], outline=col, width=w)


def finish(img, glow=0.35):
    """発光(グロー)を足して最終サイズへ縮小。"""
    base = img.convert("RGB")
    if glow:
        g = base.filter(ImageFilter.GaussianBlur(14 * SS))
        base = ImageChops.screen(base, Image.eval(g, lambda v: int(v * glow)))
    return base.resize((W, H), Image.LANCZOS)


# ---------------------------------------------------------------- scenes
def scene_kaleido(rng):
    w, h = W * SS, H * SS
    quad = Image.new("RGBA", (w // 2, h // 2), (0, 0, 0, 255))
    d = ImageDraw.Draw(quad)
    cx, cy = w // 2, h // 2
    flowers = []
    base_hue = rng.random()
    # 左上象限に、中心から放射する枝を描く(その後ミラーで4回対称)
    for i in range(rng.randint(3, 5)):
        ang = math.pi + rng.uniform(0.1, 1.4)
        branch(d, cx, cy, ang, rng.uniform(170, 250) * SS, 14 * SS, 0, rng, base_hue + i * 0.07, flowers, 4, 0.7)
    for fx, fy, fr, fh in sorted(flowers, key=lambda f: -f[2]):
        flower(d, fx, fy, fr * SS / 1.7, rng, fh)
    left = quad
    top = Image.new("RGBA", (w // 2, h), (0, 0, 0, 255))
    top.paste(left, (0, 0))
    top.paste(left.transpose(Image.FLIP_TOP_BOTTOM), (0, h // 2))
    full = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    full.paste(top, (0, 0))
    full.paste(top.transpose(Image.FLIP_LEFT_RIGHT), (w // 2, 0))
    return finish(full, 0.4)


def scene_tree(rng):
    w, h = W * SS, H * SS
    img = vgrad((40, 120, 225), (170, 215, 250), w, h)
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(40):  # 空のペイズリー(白い線)
        paisley(d, rng.uniform(0, w), rng.uniform(0, h * 0.55), rng.uniform(60, 160) * SS / 2, rng.uniform(0, math.tau), (255, 255, 255, 90))
    # 虹色の幹: 下から上へ色相が変化
    flowers = []
    hue = rng.random()
    for i in range(3):
        bx = w * (0.3 + 0.2 * i) + rng.uniform(-60, 60)
        branch(d, bx, h * 1.02, -math.pi / 2 + rng.uniform(-0.15, 0.15), rng.uniform(380, 520) * SS, 56 * SS, 0, rng, hue + i * 0.2, flowers, 6, 0.5)
    for fx, fy, fr, fh in sorted(flowers, key=lambda f: f[2]):
        flower(d, fx, fy, fr * SS * 0.9, rng, fh)
    for _ in range(18):  # 浮遊する水玉の球
        sphere(d, rng.uniform(0, w), rng.uniform(0, h * 0.7), rng.uniform(25, 70) * SS, rng.random())
    for _ in range(60):  # 雨の針
        x = rng.uniform(0, w)
        y = rng.uniform(0, h)
        d.line([(x, y), (x + 8 * SS, y + rng.uniform(80, 240) * SS)], fill=(255, 255, 255, 130), width=2 * SS)
    return finish(img, 0.2)


def scene_mandala(rng):
    w, h = W * SS, H * SS
    img = vgrad((50, 130, 230), (150, 200, 245), w, h)
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(70):
        paisley(d, rng.uniform(0, w), rng.uniform(0, h), rng.uniform(50, 150) * SS / 2, rng.uniform(0, math.tau), (255, 255, 255, 80))
    cx, cy = w * 0.55, h * 0.42
    R = w * 0.62
    for k in range(7):  # 虹の弧(曼荼羅を囲む)
        r = R * 0.78 - k * 22 * SS
        d.arc([cx - r, cy - r, cx + r, cy + r], 140, 400, fill=hsv(k / 7 * 0.8, 0.95, 1.0), width=22 * SS)
    # 点線の螺旋
    for i in range(160):
        t = i / 160 * 5.5 * math.pi
        rr = 12 * SS + t * 16 * SS
        x, y = cx + rr * math.cos(t), cy + rr * math.sin(t)
        d.ellipse([x - 5 * SS, y - 5 * SS, x + 5 * SS, y + 5 * SS], fill=hsv(i / 160, 0.5, 1.0, 230))
    # 蓮の曼荼羅: 外→内へ花弁リング
    rings = 6
    for ring in range(rings):
        n = 10 + ring * 2
        rad = R * (1 - ring / rings * 0.85) * 0.5
        for i in range(n):
            ang = math.tau * i / n + ring * 0.2
            poly = petal_poly(cx, cy, rad, ang, rad * 0.28)
            hh = 0.62 + 0.3 * math.sin(ring + i * 0.2) * 0.5 + ring * 0.03
            d.polygon(poly, fill=hsv(hh, 0.7, 0.85), outline=hsv(0.12 - ring * 0.01, 0.9, 1.0), width=3 * SS)
    d.ellipse([cx - 40 * SS, cy - 40 * SS, cx + 40 * SS, cy + 40 * SS], fill=hsv(0.12, 0.9, 1.0))
    d.ellipse([cx - 22 * SS, cy - 22 * SS, cx + 22 * SS, cy + 22 * SS], fill=(255, 255, 255, 255))
    for _ in range(14):
        sphere(d, rng.uniform(0, w), rng.uniform(0, h), rng.uniform(16, 45) * SS, rng.random())
    return finish(img, 0.15)


def scene_field(rng):
    w, h = W * SS, H * SS
    img = vgrad((6, 20, 14), (3, 10, 8), w, h)
    d = ImageDraw.Draw(img, "RGBA")
    items = []
    for _ in range(30):
        y = rng.random() ** 0.7
        items.append((y, rng.uniform(0, w), 60 + y * 260))
    for y, x, r in sorted(items):  # 奥(上)→手前(下)
        yy = h * (0.08 + y * 0.95)
        rr = r * SS
        for _ in range(5):  # 葉
            a = rng.uniform(0, math.tau)
            d.polygon(petal_poly(x, yy, rr * 0.9, a, rr * 0.22), fill=(10, rng.randint(70, 110), 50, 255), outline=hsv(0.12, 0.9, 0.8, 255))
        flower(d, x, yy, rr, rng, rng.choice([0.9, 0.52, 0.13, 0.07, 0.35]), petals=rng.choice([5, 6, 7]))
    return finish(img, 0.1)


SCENES = {"kaleido": scene_kaleido, "tree": scene_tree, "mandala": scene_mandala, "field": scene_field}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scene", default="all", choices=list(SCENES) + ["all"])
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--count", type=int, default=1, help="各シーンの枚数(seedから連番)")
    ap.add_argument("--out", help="単一出力ファイル")
    ap.add_argument("--outdir", default="out")
    a = ap.parse_args()
    names = list(SCENES) if a.scene == "all" else [a.scene]
    for name in names:
        for i in range(a.count):
            seed = a.seed + i
            img = SCENES[name](random.Random(seed))
            path = a.out if (a.out and len(names) * a.count == 1) else os.path.join(a.outdir, f"{name}_{seed}.png")
            os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
            img.save(path)
            print(path)


if __name__ == "__main__":
    main()
