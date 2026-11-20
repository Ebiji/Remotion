// 使い方: node scripts/stills.mjs outDir f1,f2,... [width] [height]
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
const [outDir, list, w, h, hide] = process.argv.slice(2);
const bundled = await bundle({entryPoint: path.resolve('src/index.ts'), onProgress: () => {}});
const comp = await selectComposition({serveUrl: bundled, id: 'MouthMV', inputProps: {hide: hide || ''}, chromiumOptions: {gl: 'swangle'}});
const c = {...comp, width: +(w || comp.width), height: +(h || comp.height)};
for (const f of list.split(',')) {
  const t0 = Date.now();
  await renderStill({composition: c, inputProps: {hide: hide || ''}, serveUrl: bundled, frame: +f, output: path.join(outDir, `f${String(f).padStart(4, '0')}${hide ? '_' + hide.replace(/,/g, '-') : ''}.png`), chromiumOptions: {gl: 'swangle'}, logLevel: 'error'});
  console.log('frame', f, Date.now() - t0, 'ms');
}
