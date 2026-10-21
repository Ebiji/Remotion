# 家のPC(Windows + NVIDIA GPU)で MV を書き出す手順

対象: GTX 1650 4GB など、数年前のGPU搭載PC。
このリポジトリの `001/` に入っている Remotion + three.js のMVを、GPUを使って高速に書き出します。

---

## 0. 事前準備(最初の1回だけ)

| 必要なもの | 入手方法 |
|---|---|
| Node.js **20以上(LTS)** | https://nodejs.org から LTS をインストール |
| NVIDIA ドライバ(最新) | GeForce Experience か https://www.nvidia.co.jp/drivers |
| ffmpeg(**フェード等に必要**) | PowerShell で `winget install Gyan.FFmpeg` → **PowerShellを開き直す** |
| Git(任意) | https://git-scm.com 。無い場合はZIPでも可(手順1参照) |

- 空き容量: **1080pは約5GB、4Kは約20GB** 必要です(途中のチャンク動画が大きいため)。
- 書き出し中にPCがスリープしないよう、「電源とスリープ」を **「なし」** にしてください。
- 書き出し中は、ゲームなどGPUを使う他のアプリを閉じてください。

## 1. コードを取得する

**Git がある場合(PowerShell)**

```powershell
git clone -b claude/festive-fermat-v6jfvr https://github.com/Ebiji/Remotion.git
cd Remotion\001
```

**ZIPで取る場合**: GitHub の `Ebiji/Remotion` を開き、ブランチ `claude/festive-fermat-v6jfvr` に切り替えて「Code → Download ZIP」。展開して、PowerShell で `001` フォルダへ移動します。

## 2. 依存パッケージを入れる

```powershell
npm install
```

(数分かかります。最初の書き出し時に、Remotionが専用のChromeを自動でダウンロードします。)

## 3. GPUが使えているか確認する

```powershell
npx remotion gpu
```

表示の中で、**WebGL / ANGLE / D3D11 が `Hardware accelerated`**(または `Enabled`)になっていればOKです。
`Software only` / `SwiftShader` と出る場合は GPU が使われていません。→ 「9. うまくいかないとき」へ。

## 4. 曲を選ぶ

```powershell
npm run song:mouth1    # Mouth1 (v1の構成で改良した版) ← いまの標準
npm run song:mouth2    # Mouth2 (視点固定・曲がる道・空いっぱいの花の版)
```

## 5. まず速度を測る(30フレームだけ描きます)

```powershell
npm run bench -- 1920 1080 angle 2 30
```

引数は `横 縦 GPU方式 並列数 フレーム数` です。終わると、次のように表示されます。

```
計測(30フレーム): xx.x秒 → 1フレーム 0.xx秒
全編 4314 フレームの書き出し見込み: 約 NN 分
```

この「見込み」を見て、画質を決めてください。4Kを測るときは `npm run bench -- 3840 2160 angle 1 30`。

## 6. 本番の書き出し

100フレームごとの「チャンク」に分けて書き出します。**途中で止めても、同じコマンドを実行すれば続きから再開します。**

```powershell
# フルHD (1080p)
node scripts/render_chunks.mjs 100 out\home1080 1920 1080 angle 2

# 4K (VRAM 4GBなので並列は1)
node scripts/render_chunks.mjs 100 out\home4k 3840 2160 angle 1
```

最後に `ALL DONE` と出れば完了です。

## 7. 仕上げ(結合 + 音声 + フェード)

```powershell
node scripts/finish_video.mjs out\home1080 out\mouth-1080p.mp4          # 速い(再圧縮なし・ファイルは大きい)
node scripts/finish_video.mjs out\home1080 out\mouth-1080p.mp4 small    # 再圧縮して小さくする(1080pで約300MB)
```

- 曲の頭に0.5秒のフェードイン、終わりに3秒のフェードアウトが付きます。
- Mouth2 は、末尾に無音の暗転を足して 2分33秒 にします。
- `ffmpeg` が見つからない場合は、フェード無しで仕上がります。手順0のとおり `winget install Gyan.FFmpeg` を入れてください。

---

## 8. GTX 1650 4GB での速度の見込み(計算)

実機で測っていないため、**目安**です。正確な数字は手順5の `bench` が出します。

**計算の考え方**

- この映像の3D描画は、1フレームあたり、画面の画素数に比例する計算(空・ビル・植物・光のにじみ)が約10〜15 GFLOP、頂点の計算が約0.5 GFLOP です。
- GTX 1650 の実効性能を約1 TFLOPS と見ると、**GPUの描画は1080pで約20〜40ミリ秒、4Kで約80〜160ミリ秒**です。
- 実際の律速は、描いたフレームの**取り出し(JPEG化)と動画への圧縮(x264)**で、これはCPUの仕事です。1080pで0.15〜0.4秒、4Kで0.5〜1.2秒かかります。

| 画質 | 1フレームの目安 | 全編(Mouth1: 4314フレーム) | 参考: 作業環境(GPUなし) |
|---|---|---|---|
| 1080p | 0.25〜0.6秒 | **約20〜45分** | 約3.5時間 |
| 4K | 0.8〜1.8秒 | **約1〜2.2時間** | 約9〜10時間 |

- CPUが古い(4コア以下)場合は、上の幅の遅い側になります。
- 4Kでは、VRAM 4GBの範囲で動きます(描画用のバッファは約600MB)。並列数が2以上だとVRAMが足りなくなる場合があります。

## 9. うまくいかないとき

| 症状 | 対処 |
|---|---|
| `npx remotion gpu` で GPU が使われていない | NVIDIAドライバを最新にする。`--gl=angle` を `--gl=egl`、または `vulkan` に変えて試す(`bench` と `render_chunks` の「GPU方式」の引数) |
| `WebGL context lost` やメモリ不足のエラー | 並列数を `1` にする(`bench` と `render_chunks` の最後の数字) |
| 4Kでエラーになる | 1080pで動くか確認。まず `npm run bench -- 3840 2160 angle 1 6` で短く試す |
| ブラウザのダウンロードで止まる | 会社のネットワーク/セキュリティソフトを一時的に確認。再度 `npm install` や書き出しを実行する |
| 途中で止まった | 同じ `render_chunks` のコマンドを実行(完成したチャンクはスキップされます) |
| 音が出ない | 再生時に音が出ない場合は、`finish_video.mjs` で作った最終ファイルを、保存してから再生してください。プレビューでは音が出ないことがあります |

## 10. このスクリプト一覧

| ファイル | 役割 |
|---|---|
| `scripts/bench.mjs` | 30フレームだけ描いて、速度と全編の見込みを表示 |
| `scripts/render_chunks.mjs` | 100フレームずつ書き出し(再開可能) |
| `scripts/finish_video.mjs` | 結合 + 音声 + フェード |
| `scripts/use_song.mjs` | 曲の切り替え |
