// 使い方: node scripts/bench.mjs [width=1920] [height=1080] [gl=angle] [concurrency=2] [frames=30]
// 30フレームだけ描いて、1フレームあたりの時間と、全編の書き出し時間の見込みを表示する。
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
const [w = '1920', h = '1080', gl = 'angle', conc = '2', n = '30'] = process.argv.slice(2);
const chromiumOptions = {gl};
const inputProps = {withAudio: false};
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), onProgress: () => {}});
const comp0 = await selectComposition({serveUrl, id: 'MouthMV', inputProps, chromiumOptions});
const comp = {...comp0, width: +w, height: +h};
const a = 2000, b = a + +n - 1;
fs.mkdirSync('out', {recursive: true});
// 1回目はシェーダーのコンパイルなどで遅いので、2回に分けて2回目の速度を採用する
const run = async (from, to) => {
  const t0 = Date.now();
  await renderMedia({composition: comp, serveUrl, codec: 'h264', outputLocation: 'out/bench.mp4', frameRange: [from, to], inputProps, chromiumOptions, concurrency: +conc, crf: 18, muted: true, timeoutInMilliseconds: 300000, logLevel: 'error'});
  return (Date.now() - t0) / 1000;
};
const warm = await run(a, a + 5);
const t = await run(a, b);
const per = t / +n;
const total = per * comp.durationInFrames;
console.log(`解像度 ${w}x${h} / gl=${gl} / 並列=${conc}`);
console.log(`ウォームアップ(6フレーム): ${warm.toFixed(1)}秒`);
console.log(`計測(${n}フレーム): ${t.toFixed(1)}秒 → 1フレーム ${per.toFixed(2)}秒 (${(1 / per).toFixed(1)} fps)`);
console.log(`全編 ${comp.durationInFrames} フレームの書き出し見込み: 約 ${(total / 60).toFixed(0)} 分 (${(total / 3600).toFixed(1)} 時間)`);
fs.rmSync('out/bench.mp4', {force: true});
