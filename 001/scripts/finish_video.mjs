// 使い方: node scripts/finish_video.mjs <チャンクのフォルダ> <出力ファイル> [small]
// チャンクを結合して音声(曲に応じたマスター音源)を付ける。頭0.5秒フェードイン・終わり3秒フェードアウト。
// Mouth2 は末尾に無音の暗転を足して 2分33秒 にする。ffmpegは Remotion 付属のものを使う。
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const [dir, outFile, opt] = process.argv.slice(2); // opt='small' で映像を再圧縮してファイルを小さくする
if (!dir || !outFile) { console.error('usage: node scripts/finish_video.mjs <chunkDir> <out.mp4>'); process.exit(1); }
const song = JSON.parse(fs.readFileSync('src/MouthMV/analysis.json', 'utf8')).song ?? 'mouth2';
const audio = path.resolve(`public/${song === 'mouth1' ? 'mouth1_mastered' : 'mouth2_mastered'}.mp3`);
const chunks = fs.readdirSync(dir).filter((f) => /^chunk_\d+\.mp4$/.test(f)).sort();
if (!chunks.length) { console.error('チャンクが見つかりません'); process.exit(1); }
const list = path.resolve(dir, 'list.txt');
fs.writeFileSync(list, chunks.map((c) => `file '${path.resolve(dir, c).replace(/\\/g, '/')}'`).join('\n'));
const frames = JSON.parse(fs.readFileSync('src/MouthMV/analysis.json', 'utf8')).frames;
const dur = frames / 30;
// 通常のffmpegがあればそれを使う (フェード等に必要)。なければ Remotion付属のffmpeg (フェードなし) で仕上げる。
const hasSys = (() => { try { execFileSync('ffmpeg', ['-version'], {stdio: 'ignore', shell: process.platform === 'win32'}); return true; } catch { return false; } })();
const ff = (args) => hasSys
  ? execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], {stdio: 'inherit', shell: process.platform === 'win32'})
  : execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['remotion', 'ffmpeg', '-v', 'error', '-y', ...args], {stdio: 'inherit', shell: process.platform === 'win32'});
if (!hasSys) console.warn('※ ffmpegが見つからないため、フェードと末尾の無音の暗転なしで仕上げます (winget install Gyan.FFmpeg で導入できます)');
if ((song === 'mouth1' || !hasSys) && !(opt === 'small' && hasSys)) {
  // 映像は再エンコードせずに結合 (速い)
  const af = hasSys ? ['-af', `afade=t=in:d=0.5,afade=t=out:st=${(dur - 3).toFixed(2)}:d=3`] : [];
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-i', audio, '-map', '0:v', '-map', '1:a', ...af, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', outFile]);
} else if (song === 'mouth1') {
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-i', audio, '-map', '0:v', '-map', '1:a', '-af', `afade=t=in:d=0.5,afade=t=out:st=${(dur - 3).toFixed(2)}:d=3`, '-c:v', 'libx264', '-crf', '20', '-maxrate', '14000k', '-bufsize', '24000k', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', outFile]);
} else {
  const total = 153; // 末尾に無音の暗転を足して 2分33秒
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-i', audio, '-filter_complex', `[0:v]tpad=stop_mode=clone:stop_duration=2,trim=duration=${total},setpts=PTS-STARTPTS[v];[1:a]afade=t=in:d=0.5,afade=t=out:st=${(dur - 3).toFixed(2)}:d=3,apad=whole_dur=${total}[a]`, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-t', String(total), '-movflags', '+faststart', outFile]);
}
console.log('完成:', outFile);
