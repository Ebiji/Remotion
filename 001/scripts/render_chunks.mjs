// 全編を区間(チャンク)ごとに書き出す。途中で止まっても、出来上がったチャンクはスキップして再開できる。
// 使い方: node scripts/render_chunks.mjs [chunkFrames=300] [outDir=out/mouth]
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition, openBrowser} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
const chunk = +(process.argv[2] || 300);
const outDir = path.resolve(process.argv[3] || 'out/mouth');
const W = +(process.argv[4] || 0), H = +(process.argv[5] || 0); // 解像度の指定 (例: 1920 1080)
fs.mkdirSync(outDir, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), onProgress: () => {}});
const chromiumOptions = {gl: 'swangle'};
const inputProps = {withAudio: false};
const comp0 = await selectComposition({serveUrl, id: 'MouthMV', inputProps, chromiumOptions});
const comp = W && H ? {...comp0, width: W, height: H} : comp0;
const browser = await openBrowser('chrome', {chromiumOptions, forceDeviceScaleFactor: 1});
const total = comp.durationInFrames;
for (let a = 0, i = 0; a < total; a += chunk, i++) {
  const b = Math.min(total - 1, a + chunk - 1);
  const out = path.join(outDir, `chunk_${String(i).padStart(2, '0')}.mp4`);
  if (fs.existsSync(out)) { console.log('skip', out); continue; }
  const t0 = Date.now();
  await renderMedia({
    composition: comp, serveUrl, codec: 'h264', outputLocation: out + '.part.mp4', frameRange: [a, b], inputProps,
    chromiumOptions, puppeteerInstance: browser, concurrency: 2, crf: 17, pixelFormat: 'yuv420p', muted: true,
    timeoutInMilliseconds: 300000, logLevel: 'error',
  });
  fs.renameSync(out + '.part.mp4', out);
  console.log(`chunk ${i} frames ${a}-${b} done in ${Math.round((Date.now() - t0) / 1000)}s`);
}
await browser.close({silent: true});
console.log('ALL DONE');
