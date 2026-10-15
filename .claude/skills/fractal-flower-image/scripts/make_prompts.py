#!/usr/bin/env python3
"""花×フラクタル画像のプロンプトをバリエーション付きで量産する。

例: python3 make_prompts.py --count 20 --seed 1 --out prompts.jsonl
    python3 make_prompts.py --scene S1 S10 --count 4
"""
import argparse
import json
import random

SCENES = {
    "S1": ("symmetrical kaleidoscope of metallic rainbow-gradient flower vines forming a diamond lattice, daisies on branch tips, infinite recursion toward the center", "front view, slow zoom out", "pure black background"),
    "S2": ("worm's-eye view of a giant rainbow-gradient tree trunk with a canopy of flower clusters, glass-needle rain, floating colored spheres", "extreme low angle", "deep saturated blue sky"),
    "S3": ("top-down macro of rainbow-gradient flower petals covered in refracting water droplets and one giant lens-like drop", "macro, shallow depth of field", "blurred rainbow bokeh"),
    "S4": ("Fibonacci spiral of polka-dot spheres, diagonal rainbow rain streaks", "diagonal composition", "midnight navy background"),
    "S5": ("recursive flower-tree with clustered blossoms and a spiral of beads in the sky, floating spheres", "low angle looking up", "saturated blue sky with soft clouds"),
    "S6": ("dense field of magenta, turquoise, yellow and orange flowers, every petal covered in water droplets, dark green leaves", "tilted top-down macro", "dark foliage"),
    "S7": ("grey fractal architecture arch pierced by a rainbow gradient, flower path in the foreground", "one-point perspective", "soft white clouds"),
    "S8": ("sky filled with huge pink, cyan and yellow paisley swirls, arch in the center, red trees left and right, flowers below", "wide-angle", "paisley sky"),
    "S9": ("dense forest of orange rainbow-gradient fractal trees seen from above, double rainbow, polka-dot spheres", "aerial view moving forward", "blue sky with paisley outlines"),
    "S10": ("giant lotus mandala medallion with concentric rings, rainbow arc and a dotted spiral", "centered, rotating zoom into the center", "blue paisley sky"),
}
PART = ["petals", "trunk", "branches", "arch", "stems"]
WATER = ["macro water droplets refracting the rainbow", "floating soap bubbles", "glass-needle rain streaks", "polka-dot spheres", "giant hanging water drop"]
PATTERN = ["paisley swirls", "polka dots", "mandala medallion", "Julia-set filigree", "Fibonacci spiral"]
PALETTE = ["magenta, turquoise, yellow and orange", "red, orange, yellow, green, cyan, blue, purple", "pink, cyan, lime and gold", "orange, magenta and electric blue"]
TAIL = "ultra detailed, vivid saturated colors, cel-shaded paint texture, high contrast, 9:16 vertical, 1080x1920"
NEGATIVE = "text, logo, watermark, signature, human, muted colors, pastel, blurry, low saturation, photographic, grey sky"


def build(sid: str, rng: random.Random) -> dict:
    core, cam, bg = SCENES[sid]
    prompt = ", ".join([
        core, cam, bg,
        f"rainbow gradient across the {rng.choice(PART)}",
        f"palette of {rng.choice(PALETTE)}",
        rng.choice(WATER),
        rng.choice(PATTERN),
        TAIL,
    ])
    return {"scene": sid, "prompt": prompt, "negative": NEGATIVE, "aspect": "9:16"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=10)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--scene", nargs="*", help="例: S1 S10 (省略時は全型を巡回)")
    ap.add_argument("--out", help="JSONL出力先 (省略時は標準出力)")
    a = ap.parse_args()
    rng = random.Random(a.seed)
    ids = a.scene or list(SCENES)
    bad = [i for i in ids if i not in SCENES]
    if bad:
        raise SystemExit(f"unknown scene: {bad}")
    rows = [build(ids[i % len(ids)], rng) for i in range(a.count)]
    text = "\n".join(json.dumps(r, ensure_ascii=False) for r in rows)
    if a.out:
        open(a.out, "w", encoding="utf-8").write(text + "\n")
        print(f"wrote {len(rows)} prompts -> {a.out}")
    else:
        print(text)


if __name__ == "__main__":
    main()
