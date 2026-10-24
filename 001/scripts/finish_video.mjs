// 使い方: node scripts/finish_video.mjs <チャンクのフォルダ> <出力ファイル> [small] [title=<タイトル連番のフォルダ>]
// チャンクを結合し、曲に応じたマスター音源を付ける。頭0.5秒フェードイン。
// 曲の終わりのあとに3秒の無音の暗転を足す(終わりのフェードアウトはかけず、音源を最後まで流す)。title=... を付けると、曲の最後の15秒にタイトル文字を重ねる
// (文字の連番は scripts/render_title.mjs で作る)。ffmpegは通常のもの(フェード等に必要)があればそれを使い、なければ Remotion付属を使う。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
const [dir, outFile, ...opts] = process.argv.slice(2);
if (!dir || !outFile) { console.error('usage: node scripts/finish_video.mjs <chunkDir> <out.mp4> [small] [hq] [title=<dir>]'); process.exit(1); }
const small = opts.includes('small');
const titleDir = (opts.find((o) => o.startsWith('title=')) || '').slice(6);
const meta = JSON.parse(fs.readFileSync('src/MouthMV/analysis.json', 'utf8'));
const song = meta.song ?? 'mouth2';
const audio = path.resolve(`public/${song === 'mouth1' ? 'mouth1_mastered' : 'mouth2_mastered'}.mp3`);
const chunks = fs.readdirSync(dir).filter((f) => /^chunk_\d+\.mp4$/.test(f)).sort();
if (!chunks.length) { console.error('チャンクが見つかりません'); process.exit(1); }
const list = path.resolve(dir, 'list.txt');
fs.writeFileSync(list, chunks.map((c) => `file '${path.resolve(dir, c).replace(/\\/g, '/')}'`).join('\n'));
const dur = meta.frames / 30;           // 曲の長さ(秒)
const win = process.platform === 'win32';
const hasSys = (() => { try { execFileSync('ffmpeg', ['-version'], {stdio: 'ignore', shell: win}); return true; } catch { return false; } })();
const scaleOpt = opts.find((o) => /^w\d+$/.test(o));   // 例: w1280 → その幅に縮小して書き出す(4Kから720pを作るとき高画質)
const widthSrc = (() => { try { return +execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width', '-of', 'csv=p=0', path.resolve(dir, chunks[0])], {shell: win}).toString().trim(); } catch { return 1920; } })();
const widthOf = scaleOpt ? +scaleOpt.slice(1) : widthSrc;
// 圧縮の上限ビットレート: 画面が大きいほど高く (4Kは約45Mbps)
const hq = opts.includes('hq');                  // hq: ブロックノイズが出ないよう、ビットレートを大きく取る
const mrOpt = opts.find((o) => /^mr\d+$/.test(o));   // 例: mr18000 → 上限ビットレート(kbps)を直接指定
const maxrate = mrOpt ? ['-maxrate', `${mrOpt.slice(2)}k`, '-bufsize', `${mrOpt.slice(2) * 2}k`] : hq ? (widthOf >= 3000 ? ['-maxrate', '120000k', '-bufsize', '240000k'] : widthOf >= 2400 ? ['-maxrate', '60000k', '-bufsize', '120000k'] : ['-maxrate', '30000k', '-bufsize', '60000k']) : widthOf >= 3000 ? ['-maxrate', '45000k', '-bufsize', '80000k'] : widthOf >= 2400 ? ['-maxrate', '24000k', '-bufsize', '40000k'] : ['-maxrate', '14000k', '-bufsize', '24000k'];
const ff = (args) => hasSys
  ? execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], {stdio: 'inherit', shell: win})
  : execFileSync(win ? 'npx.cmd' : 'npx', ['remotion', 'ffmpeg', '-v', 'error', '-y', ...args], {stdio: 'inherit', shell: win});
if (!hasSys) console.warn('※ ffmpegが見つからないため、フェード・末尾の暗転・タイトルなしで仕上げます (winget install Gyan.FFmpeg で導入できます)');
const TAIL = 3;                                   // 曲の終わりのあとに足す無音の暗転(秒)
const fade = `afade=t=in:d=0.5`;                 // 頭だけフェードイン。終わりは音源そのままで最後まで流す
const vbOpt = opts.find((o) => /^vb\d+$/.test(o));       // 例: vb23000 → H.265で平均ビットレートkbpsを指定(容量を揃えたいとき)
const vb = vbOpt ? +vbOpt.slice(2) : 0;
const enc = opts.includes('hevc') ? ['-c:v', 'libx265', '-preset', 'medium', ...(vb ? ['-b:v', `${vb}k`, '-x265-params', `vbv-maxrate=${Math.round(vb * 1.8)}:vbv-bufsize=${Math.round(vb * 3.5)}:log-level=error`] : ['-crf', '18']), '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart'] : ['-c:v', 'libx264', '-crf', hq ? '14' : small || titleDir ? '20' : '18', ...maxrate, '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart'];
if (!hasSys) {
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', outFile]);
} else if (opts.includes('std')) {
  // X/YouTube向けの標準仕様: H.264 High / 30fps固定 / AAC 192k / 色はbt601→bt709に変換して明記 / 2パスで平均ビットレートを指定
  const total = +(dur + TAIL).toFixed(3);
  const t0 = (dur - 15).toFixed(3);
  const W = scaleOpt ? scaleOpt.slice(1) : '1920';
  const dn = opts.includes('dn') ? ',hqdn3d=1.2:1.2:5:5' : '';   // dn: 細かいノイズを少しだけ減らす(再圧縮でつぶれにくくする)
  const sc = `scale=${W}:-2:flags=lanczos+accurate_rnd+full_chroma_int`;
  const base = `[0:v]tpad=stop_mode=clone:stop_duration=${TAIL + 1},trim=duration=${total},setpts=PTS-STARTPTS,${sc}:in_color_matrix=bt601:in_range=pc,format=gbrp${dn}`;
  const inputs = ['-f', 'concat', '-safe', '0', '-i', list, '-i', audio];
  let vf = `${base}[o]`;
  if (titleDir) {
    inputs.push('-framerate', '30', '-i', path.resolve(titleDir, 'element-%03d.png').replace(/\\/g, '/'));
    vf = `${base}[b];[2:v]format=rgba,scale=${W}:-2:flags=lanczos,setpts=PTS-STARTPTS+${t0}/TB[t];[b][t]overlay=format=auto:eof_action=pass[o]`;
  }
  const outv = `[o]scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p,fps=30[v]`;
  const rate = vb || 10000;
  const venc = ['-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-level', '4.2', '-b:v', `${rate}k`, '-maxrate', `${Math.round(rate * 1.2)}k`, '-bufsize', `${rate * 2}k`, '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-g', '60', '-fps_mode', 'cfr'];
  const logf = path.resolve(os.tmpdir(), `x264pass_${Date.now()}`);
  ff([...inputs, '-filter_complex', `${vf};${outv}`, '-map', '[v]', ...venc, '-pass', '1', '-passlogfile', logf, '-an', '-t', String(total), '-f', 'mp4', win ? 'NUL' : '/dev/null']);
  ff([...inputs, '-filter_complex', `${vf};${outv};[1:a]${fade},apad=whole_dur=${total}[a]`, '-map', '[v]', '-map', '[a]', ...venc, '-pass', '2', '-passlogfile', logf, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(total), '-movflags', '+faststart', outFile]);
} else {
  const total = +(dur + TAIL).toFixed(3);        // 曲の長さ + 暗転 (Mouth2は約2分34.6秒)
  const base = `[0:v]tpad=stop_mode=clone:stop_duration=${TAIL + 1},trim=duration=${total},setpts=PTS-STARTPTS${scaleOpt ? `,scale=${scaleOpt.slice(1)}:-2:flags=lanczos` : ''}`;
  const t0 = (dur - 15).toFixed(3);          // 曲の最後の15秒
  const inputs = ['-f', 'concat', '-safe', '0', '-i', list, '-i', audio];
  let vf = `${base}[v]`;
  if (titleDir) {
    inputs.push('-framerate', '30', '-i', path.resolve(titleDir, 'element-%03d.png').replace(/\\/g, '/'));
    vf = `${base}[b];[2:v]format=rgba${scaleOpt ? `,scale=${scaleOpt.slice(1)}:-2:flags=lanczos` : ''},setpts=PTS-STARTPTS+${t0}/TB[t];[b][t]overlay=format=auto:eof_action=pass[v]`;
  }
  const af = `${fade},apad=whole_dur=${total}`;
  ff([...inputs, '-filter_complex', `${vf};[1:a]${af}[a]`, '-map', '[v]', '-map', '[a]', ...enc, '-t', String(total), outFile]);
}
console.log('完成:', outFile);
