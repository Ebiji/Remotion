// 使い方: node scripts/finish_video.mjs <チャンクのフォルダ> <出力ファイル> [small] [title=<タイトル連番のフォルダ>]
// チャンクを結合し、曲に応じたマスター音源を付ける。頭0.5秒フェードイン・終わり3秒フェードアウト。
// Mouth2 は末尾に無音の暗転を足して 2分33秒 にする。title=... を付けると、曲の最後の15秒にタイトル文字を重ねる
// (文字の連番は scripts/render_title.mjs で作る)。ffmpegは通常のもの(フェード等に必要)があればそれを使い、なければ Remotion付属を使う。
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const [dir, outFile, ...opts] = process.argv.slice(2);
if (!dir || !outFile) { console.error('usage: node scripts/finish_video.mjs <chunkDir> <out.mp4> [small] [title=<dir>]'); process.exit(1); }
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
const widthOf = (() => { try { return +execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width', '-of', 'csv=p=0', path.resolve(dir, chunks[0])], {shell: win}).toString().trim(); } catch { return 1920; } })();
// 圧縮の上限ビットレート: 画面が大きいほど高く (4Kは約45Mbps)
const maxrate = widthOf >= 3000 ? ['-maxrate', '45000k', '-bufsize', '80000k'] : widthOf >= 2400 ? ['-maxrate', '24000k', '-bufsize', '40000k'] : ['-maxrate', '14000k', '-bufsize', '24000k'];
const ff = (args) => hasSys
  ? execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], {stdio: 'inherit', shell: win})
  : execFileSync(win ? 'npx.cmd' : 'npx', ['remotion', 'ffmpeg', '-v', 'error', '-y', ...args], {stdio: 'inherit', shell: win});
if (!hasSys) console.warn('※ ffmpegが見つからないため、フェード・末尾の暗転・タイトルなしで仕上げます (winget install Gyan.FFmpeg で導入できます)');
const fade = `afade=t=in:d=0.5,afade=t=out:st=${(dur - 3).toFixed(2)}:d=3`;
const enc = ['-c:v', 'libx264', '-crf', small || titleDir ? '20' : '18', ...maxrate, '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart'];
if (!hasSys) {
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', outFile]);
} else if (song === 'mouth1' && !small && !titleDir) {
  // 映像は再エンコードせずに結合 (速い)
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-i', audio, '-map', '0:v', '-map', '1:a', '-af', fade, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', outFile]);
} else {
  const total = song === 'mouth2' ? 153 : dur; // Mouth2は末尾に無音の暗転を足して 2分33秒
  const base = song === 'mouth2' ? `[0:v]tpad=stop_mode=clone:stop_duration=2,trim=duration=${total},setpts=PTS-STARTPTS` : `[0:v]setpts=PTS-STARTPTS`;
  const t0 = (dur - 15).toFixed(3);          // 曲の最後の15秒
  const inputs = ['-f', 'concat', '-safe', '0', '-i', list, '-i', audio];
  let vf = `${base}[v]`;
  if (titleDir) {
    inputs.push('-framerate', '30', '-i', path.resolve(titleDir, 'element-%03d.png').replace(/\\/g, '/'));
    vf = `${base}[b];[2:v]format=rgba,setpts=PTS-STARTPTS+${t0}/TB[t];[b][t]overlay=format=auto:eof_action=pass[v]`;
  }
  const af = song === 'mouth2' ? `${fade},apad=whole_dur=${total}` : fade;
  ff([...inputs, '-filter_complex', `${vf};[1:a]${af}[a]`, '-map', '[v]', '-map', '[a]', ...enc, '-t', String(total), outFile]);
}
console.log('完成:', outFile);
