// 使い方: node scripts/use_song.mjs mouth1|mouth2  — 曲の解析データを切り替える (Windows/Mac/Linux共通)
import fs from 'node:fs';
const song = process.argv[2];
if (!['mouth1', 'mouth2'].includes(song)) { console.error('usage: node scripts/use_song.mjs mouth1|mouth2'); process.exit(1); }
fs.copyFileSync(`src/MouthMV/analysis.${song}.json`, 'src/MouthMV/analysis.json');
console.log(`曲を ${song} に切り替えました`);
