// タイトル文字(透明PNG連番)を書き出す。 使い方: node scripts/render_title.mjs <width> <height> <outDir> [text] [composition]
// composition: TitleOverlay(15秒, 既定) / TitleOverlay10(10秒)
// 出力: <outDir>/element-000.png ... (450枚)。finish_video.mjs の title=<outDir> で動画に重ねる。
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [w = '1920', h = '1080', outDir = 'out/title', text = 'Flowers & Towers', comp = 'TitleOverlay'] = process.argv.slice(2);
fs.rmSync(outDir, {recursive: true, force: true});
const win = process.platform === 'win32';
const props = JSON.stringify({text});
execFileSync(win ? 'npx.cmd' : 'npx', ['remotion', 'render', 'src/index.ts', comp, outDir, '--sequence', '--image-format=png', `--width=${w}`, `--height=${h}`, '--concurrency=1', `--props=${win ? props.replace(/"/g, '\\"') : props}`], {stdio: 'inherit', shell: win});
console.log('title frames:', fs.readdirSync(outDir).filter((f) => f.endsWith('.png')).length, path.resolve(outDir));
