#!/usr/bin/env python3
"""女性スキャット(声域の旋律線)の抽出: HPSSで打楽器を除き、150-1200Hzをpyinでピッチ追跡。
出力: vox(声の存在/強さ), pitch(0..1正規化), voxOn(音の出だしのフレーム)をanalysisのJSONへ追記。
usage: analyze_voice.py in.wav analysis.json"""
import sys, json, numpy as np, librosa
FPS = 30
wav, dst = sys.argv[1], sys.argv[2]
y, sr = librosa.load(wav, sr=22050, mono=True)
hop = int(round(sr / FPS))
H, _ = librosa.effects.hpss(y, margin=2.0)
# 声域に絞る
S = np.abs(librosa.stft(H, n_fft=2048, hop_length=hop, center=True))
fr = librosa.fft_frequencies(sr=sr, n_fft=2048)
band = (fr >= 200) & (fr <= 3500)
env = np.sqrt((S[band] ** 2).mean(0))
f0, vflag, vprob = librosa.pyin(H, fmin=160, fmax=1200, sr=sr, frame_length=2048, hop_length=hop, fill_na=np.nan, resolution=0.1)
n = min(len(env), len(f0))
env, f0, vprob = env[:n], f0[:n], vprob[:n]
vprob = np.nan_to_num(vprob)
e = (env - np.percentile(env, 10)) / (np.percentile(env, 97) - np.percentile(env, 10) + 1e-9)
e = np.clip(e, 0, 1.2)
vox = np.clip(vprob * (0.35 + 0.65 * e), 0, 1)
# スムージング
k = np.ones(3) / 3
vox = np.convolve(vox, k, 'same')
midi = np.where(np.isnan(f0), np.nan, librosa.hz_to_midi(np.nan_to_num(f0, nan=440)))
# ピッチ(欠損は直前値で保持)→0..1
p = np.zeros(n); last = 66.0
for i in range(n):
    if not np.isnan(midi[i]) and vprob[i] > 0.4: last = midi[i]
    p[i] = last
p = np.clip((p - 52) / (88 - 52), 0, 1)
ps = np.convolve(np.pad(p, 3, mode='edge'), np.ones(7) / 7, 'valid')
# 音の出だし: 有声化の立ち上がり or 2半音以上のジャンプ
on = []
gate = vprob > 0.5
last_on = -99
for i in range(2, n):
    rise = gate[i] and not gate[i - 2]
    jump = gate[i] and gate[i - 1] and abs(midi[i] - midi[i - 1]) > 1.6 if not np.isnan(midi[i]) and not np.isnan(midi[i - 1]) else False
    if (rise or jump) and i - last_on >= 4:
        on.append(i); last_on = i
d = json.load(open(dst))
m = d['frames']
def fit(a): a = list(a[:m]) + [a[-1]] * max(0, m - len(a)); return [round(float(x), 3) for x in a]
d['vox'] = fit(vox); d['pitch'] = fit(ps); d['voxOn'] = [int(i) for i in on if i < m]
json.dump(d, open(dst, 'w'))
act = (vox > 0.3).mean()
print('frames', n, 'voiced>0.3 ratio', round(float(act), 2), 'onsets', len(on))
for s in range(0, n, 300):
    print(f"{s/FPS:6.1f}s vox={vox[s:s+300].mean():.2f} pitchMIDI~{np.nanmedian(midi[s:s+300]):.0f} on={sum(1 for o in on if s<=o<s+300)}")
