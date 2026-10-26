# HARNESS: 書き出し・仕上げ・運用の手順

作業ディレクトリは `001/`(以下のコマンドは、そこで実行)。
**クラウドコンテナ(CPUのみ)で長い書き出しをする前提**の手順。自宅PC(GPU)は `001/HOME_PC_RENDER.md`。

## 0. 前提
- `npm install`、システムの `ffmpeg`/`ffprobe`(**必須**。Remotion同梱のffmpegには `afade`/`tpad`/x265 がなく、`finish_video.mjs` が機能を落とす)。
- 解析: Python(numpy、声の解析は librosa)。Chromium(`/opt/pw-browsers`)、Playwrightは入れ直さない。
- 曲ファイル: `public/mouth1_mastered.mp3`, `public/mouth2_mastered.mp3`(**マスター音源**を使う)。

## 1. 曲の解析 → 切り替え
```
ffmpeg -i song.mp3 -ac 1 -ar 22050 song.wav
python3 scripts/analyze_audio.py song.wav src/MouthMV/analysis.<曲>.json
python3 scripts/analyze_voice.py song.wav src/MouthMV/analysis.<曲>.json   # 声(スキャット)の線を追記
npm run song:mouth1    # または song:mouth2  (= node scripts/use_song.mjs)
```
- **`analysis.json` の `song` が、描画の構成(v1/v6)と、`finish_video.mjs` が使う曲を決める。**
  別の曲の作業に切り替える前に、**必ず `grep -o '"song": *"[a-z0-9]*"' src/MouthMV/analysis.json`** で確認する。
- 長い書き出し中は `analysis.json` を切り替えない。終わったら元に戻して、コミットする。

## 2. 描画(チャンク書き出し)
```
node scripts/bench.mjs 1920 1080 swangle 2 30      # 1フレームの時間と全編の見込み
node scripts/stills.mjs out/stills 300,1200,2400 1280 720   # 静止画で見た目の確認
./scripts/render_supervised.sh <outDir> 100 <W> <H> <logFile> swangle 2
```
- `render_chunks.mjs` は**100フレームごと**のMP4(`chunk_NN.mp4`、h264 crf17、音なし)を作る。**完成分はスキップ**するので、止まっても続きから。
- `render_supervised.sh` は、プロセスが落ちたら再開し、ログに `ALL DONE` が出るまで見張る。
- **画質の決め手: 4Kで描いて、1080pに縮める。** 1080pで直接描くとギザギザ(`antialias:false`)や細部のちらつきが残る。v6はこの方法。v1も4Kで描き直した(`out/m1_4k`)。
- 実測(このコンテナ、CPU): 720p ≈ 2.7秒/フレーム、1080p ≈ 3秒、2K ≈ 7秒、**4K ≈ 14〜18秒/フレーム**(全編 約11〜18時間)。GPUの自宅PCなら 4K で 1〜2時間台の見込み(未実測)。
- 描画結果のチャンクの色は `yuvj420p`(フルレンジ)・`bt470bg`。**仕上げで必ず変換する**(§3)。

### 止まらないための運用(コンテナ)
- コンテナは、**アイドルだと再起動して、プロセスが全部死ぬ**(ファイルは残る)。
- 次の3点セットで続ける:
  1. `render_supervised.sh` を `nohup` で起動(死んだら再開)。
  2. 完了待ちのコマンド: `until grep -q "ALL DONE" <log>; do sleep 30; done`(**バックグラウンド、timeout 7200000**。2時間で切れるので、切れたら立ち上げ直す)。
  3. `send_later` で25分ごとの確認を予約(進み具合の確認、止まっていたら再開、完了したら次の工程)。
- 再起動の通知を受けたら、`pgrep -f '[r]ender_supervised'` で確認して、いなければ起動し直す。
- **落とし穴**: `pkill -f render_chunks` は自分のシェルも落とす。角括弧つきのパターン(`[r]ender_chunks`)を使う。待機コマンドが監視していたPIDが別物で、早く「完了」と出ることがある。**ファイル・ログの実体で確認**する。
- 容量: チャンクは4Kで約110MB/個(全編約5GB)。ディスクが足りなければ、不要な `out/*` を消す。

## 3. 仕上げ(結合・音・題名・エンコード) `scripts/finish_video.mjs`
```
node scripts/finish_video.mjs <チャンクのフォルダ> <出力.mp4> [オプション...]
```
共通: 曲の長さ + **3秒の黒・無音**(`TAIL`)。**音のフェードアウトは足さない**(頭の0.5秒のフェードインのみ)。

| オプション | 意味 |
|---|---|
| `title=<dir>` | 題名の透明PNG連番(`out/title4k`)を、**曲の最後の15秒**に重ねる |
| `std` | **X/YouTube向けの標準仕様**: H.264 High、30fps固定、AAC 192k、**色を bt601→bt709 に変換して明記**、2パス |
| `vb<kbps>` | 平均ビットレート(`std` の既定 10000)。`hevc` と併用でH.265 |
| `dn` | 細かいノイズを少しだけ減らす(`hqdn3d`)。再圧縮でつぶれにくくする狙い |
| `w<幅>` | その幅に縮小(例 `w1920`)。題名の画像も一緒に縮小する |
| `hq` / `mr<kbps>` | 旧モード: crf14 + 上限ビットレート。`std` を使うほうが安全 |
| `hevc` | H.265(`libx265`、`-tag:v hvc1`)。**投稿先が受け付ける場合のみ** |
| `small` | 旧モード: crf20 |

**色の落とし穴**: チャンクは `yuvj420p`/`bt470bg`。そのまま `yuv420p` にすると、色の方式が不明のまま、再生側で色がずれる。`std` は `scale=in_color_matrix=bt601:in_range=pc` → RGB(題名を重ねる) → `out_color_matrix=bt709:out_range=tv` と変換して、bt709を明記する。

### 題名(最後の15秒)
```
node scripts/render_title.mjs 3840 2160 out/title4k      # 450枚の透明PNG(約6分)
```
- `src/TitleOverlay.tsx`: **縦三段組 Flowers / & / Towers**。Cormorant Garamond(`public/fonts`)。「Flowers」は細いイタリック、「&」は金色(#f3c77a)、「Towers」は直立(500)。文字色はクリーム(#fff6e6)、やわらかい光のにじみ。後ろに暗いぼかしの楕円(万華鏡の上でも読める)。
- 動き: Flowersは、ぼけからピントが合い字間が広がる / &は、ふわっと / Towersは、下から立ち上がる(クリップ) / 最後の1.2秒でやわらかく消える。揺らさない・跳ねさせない。
- 題名の画像は4Kで1回作れば、1080pにも縮めて使える(解像度ごとに作り直し不要)。

## 4. 投稿先の仕様(2026年時点の私の理解。必ず最新の公式を確認)
- **X(有料プラン)**: H.264 High、MP4、AAC、1080p、30fps固定、約6〜12 Mbps(表の目安)。**実績: 約10 Mbps(`std vb10000`)で投稿できた。** 16 Mbpsも作ったが、表の目安は超える。長さは、無料は140秒まで、有料は長尺可(**この動画は154.6秒/146.8秒で、有料が必要**だった)。Xは再圧縮するので、**元の画質を上げておく**のが効く(4K描き直し→1080p縮小)。
- **YouTube**: 4Kで上げると、高いビットレートで配信される。アップ直後は低画質のことがある(処理待ち)。
- **4KのH.264は、20 Mbps台では、この映像(細部が多い)でブロックノイズが出る。** 4Kで出すなら H.265 で約20 Mbps以上。ただし受け付け先を確認。
- **ユーザーへの送信の上限**: 1ファイル 400〜500MiB(日により違う)。超えたら、ビットレートを下げて作り直す。

## 5. 出力の一覧(再現コマンド)
| 作品 | 描画 | 仕上げ |
|---|---|---|
| **v6 / Mouth2 / X用** | 4K: `./scripts/render_supervised.sh out/m2_4k 100 3840 2160 <log> swangle 2` | `npm run song:mouth2` → `node scripts/finish_video.mjs out/m2_4k out/mouth2-v6-1080p-spec.mp4 std vb10000 title=out/title4k` |
| **v1 / Mouth1 / X用** | 4K: `./scripts/render_supervised.sh out/m1_4k 100 3840 2160 <log> swangle 2`(**`song:mouth1` で**) | `node scripts/finish_video.mjs out/m1_4k out/mouth1-v1-1080p-ss.mp4 std vb10000 title=out/title4k` |

出力の動画(`out/*.mp4`)とチャンク(`out/m*_*k`)は **git に入れない**(`.gitignore`)。`git add -A` した後は、`001/out` を外す。

## 6. コミット・プッシュ
- ブランチ運用は、依頼のあるブランチ。**PRは、依頼されたときだけ**。
- 動画やチャンクをコミットしない(誤って入れたら `git reset --soft`、`.gitignore`、再コミット)。
- 作業中に `analysis.json` が曲ごとに変わる。**どの曲で終えるか**を決めてコミットする。
