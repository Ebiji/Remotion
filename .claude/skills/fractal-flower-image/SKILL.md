---
name: fractal-flower-image
description: 「花とフラクタルを掛け合わせた」サイケデリックな縦型(9:16)画像・動画素材のプロンプトを量産する。2026SpringFlowerFractal の分析に基づくスタイル。画像生成AI用プロンプトの作成、シーン別バリエーション、バッチ出力、Remotionでの動画化まで。「花フラクタル」「フラクタルの花」「虹の花畑」「サイケ花動画」「春のフラクタル」の依頼で使う。
---

# fractal-flower-image

`2026SpringFlowerFractal` の46フレーム分析（`001/analysis/2026SpringFlowerFractal_analysis.md`）から抽出したスタイルで、花×フラクタル画像を量産するためのスキル。

このスキル自体は画像を直接描画しない。**高品質なプロンプトと生成計画を作る**ことが役割。実際の描画は、使える画像生成手段（外部の画像生成AI／利用者が指定したAPI／ローカルのモデル）に渡す。描画手段が不明なら、最初に利用者へ確認する。

## 手順

1. **シーン型を選ぶ** — `references/scene-catalog.md` の10型（S1〜S10）から選ぶ。指定がなければ「動画1本＝S1→…→S10の流れ」で10枚を作る。
2. **プロンプトを組み立てる** — 公式: `[被写体=花×フラクタル] + [構図/カメラ] + [背景] + [虹グラデ指定] + [水滴/球体/ペイズリー] + [画質・比率]`。
   `scripts/make_prompts.py` が型と乱数シードからバリエーションを自動生成する。
3. **バッチ出力** — `python3 .claude/skills/fractal-flower-image/scripts/make_prompts.py --count 20 --seed 1 --out prompts.jsonl`
4. **生成・選別** — 各プロンプトを4枚ずつ生成し、`references/checklist.md` の基準で選ぶ。
5. **動画化** — 選んだ画像は `001/public/` に置き、`001/src/SingleImageMorph.tsx`（1枚変形・10秒）や `FractalFlowers.tsx`（複数枚つなぎ）の `staticFile(...)` を差し替えて Remotion で書き出す（`npm run render:morph` / `npm run render`）。

## 守ること

- 縦長 9:16（1080x1920 推奨）。
- 色は **1つの物体の中で虹グラデ**。背景は「真っ黒」か「濃い青空/濃紺」のどちらか。
- 主題が花なら、必ず **再帰構造（枝・花弁・葉に同じ形が入れ子）** を指定する。ただの花畑にしない。
- 水滴・球体・ペイズリー/ドットのうち最低1つを入れる。
- 文字・ロゴ・透かしを入れない（`negative` に含める）。
- 既存作品のフレームをそのまま再利用しない。スタイルのみ参照する。

## 参照

- `references/style-guide.md` — 語彙集（色・質感・光・カメラ）とプロンプトの型
- `references/scene-catalog.md` — 10シーン型の基本プロンプトと動きの指示
- `references/checklist.md` — 合否チェック
- `001/reference/frames/` — 元の46フレーム（スタイルの目視確認用）
