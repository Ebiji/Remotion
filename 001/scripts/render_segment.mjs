// 区間だけを書き出す(見比べ用プレビュー): node scripts/render_segment.mjs <out.mp4> <from> <to> <W> <H>
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import path from 'node:path';
const [out, a, b, W, H] = process.argv.slice(2);
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), onProgress: () => {}});
const chromiumOptions = {gl: 'swangle'}; const inputProps = {withAudio: false};
const c0 = await selectComposition({serveUrl, id: 'MouthMV', inputProps, chromiumOptions});
await renderMedia({composition: {...c0, width: +W, height: +H}, serveUrl, codec: 'h264', outputLocation: out, frameRange: [+a, +b], inputProps, chromiumOptions, concurrency: 2, crf: 16, muted: true, logLevel: 'error'});
console.log('done', out);
