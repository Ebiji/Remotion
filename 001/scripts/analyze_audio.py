#!/usr/bin/env python3
"""音源を30fpsのフレーム単位で解析し、帯域エネルギー・オンセット・ビートをJSON化する (numpyのみ)。
usage: analyze_audio.py in.wav out.json  (wavは mono 22050Hz)"""
import sys, json, wave
import numpy as np

FPS = 30
src, dst = sys.argv[1], sys.argv[2]
w = wave.open(src)
sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
N, HOP = 2048, sr // FPS * 1  # 735 samples @22050
HOP = int(round(sr / FPS))
nfr = int(len(x) / sr * FPS)
win = np.hanning(N)
freqs = np.fft.rfftfreq(N, 1 / sr)
bands = {'bass': (30, 150), 'lowmid': (150, 500), 'mid': (500, 2000), 'high': (2000, 9000)}
S = np.zeros((nfr, len(freqs)), np.float32)
pad = np.pad(x, (N // 2, N))
for i in range(nfr):
    s = i * HOP
    S[i] = np.abs(np.fft.rfft(pad[s:s + N] * win))
out = {'fps': FPS, 'frames': nfr}
env, flux = {}, {}
for k, (a, b) in bands.items():
    m = (freqs >= a) & (freqs < b)
    e = np.sqrt((S[:, m] ** 2).mean(1))
    e = np.log1p(e * 30)
    e = (e - np.percentile(e, 5)) / (np.percentile(e, 98) - np.percentile(e, 5))
    env[k] = np.clip(e, 0, 1.2)
    d = np.maximum(0, np.diff(np.log1p(S[:, m].sum(1) * 5), prepend=0))
    flux[k] = d / (np.percentile(d, 99) + 1e-9)
    out[k] = [round(float(v), 3) for v in env[k]]
    out[k + '_flux'] = [round(float(v), 3) for v in np.clip(flux[k], 0, 1.5)]
rms = np.sqrt((x[: nfr * HOP].reshape(nfr, HOP) ** 2).mean(1))
rms = np.convolve(rms, np.ones(15) / 15, 'same')
out['loud'] = [round(float(v), 3) for v in rms / rms.max()]

def peaks(f, thr, gap):
    idx, last = [], -99
    for i in range(1, len(f) - 1):
        if f[i] > thr and f[i] >= f[i - 1] and f[i] > f[i + 1] and i - last >= gap:
            idx.append(i); last = i
    return idx

kicks = peaks(flux['bass'], 0.35, 4)
snares = peaks(flux['mid'] + flux['lowmid'] * 0.5, 0.45, 4)
hats = peaks(flux['high'], 0.5, 2)
# tempo: onset-envelope autocorrelation
on = flux['bass'] + flux['mid'] * 0.7 + flux['high'] * 0.3
on = on - on.mean()
ac = np.correlate(on, on, 'full')[len(on) - 1:]
lo, hi = int(FPS * 60 / 200), int(FPS * 60 / 70)
lag = lo + int(np.argmax(ac[lo:hi]))
bpm = 60 * FPS / lag
# 拍周期を小数まで精密化 (オンセット包絡の補間和を最大化)
def score(per, off):
    t = np.arange(off, nfr - 1, per)
    i = t.astype(int); fr = t - i
    return float((on[i] * (1 - fr) + on[i + 1] * fr).sum())
best_s, period_f, best = -1, lag, 0
for per in np.arange(lag - 0.6, lag + 0.6, 0.005):
    for off in np.arange(0, per, 0.25):
        sc = score(per, off)
        if sc > best_s: best_s, period_f, best = sc, per, off
period = period_f
bpm = 60 * FPS / period
beats = [round(float(t), 3) for t in np.arange(best, nfr, period)]
out.update(kicks=kicks, snares=snares, hats=hats, bpm=round(bpm, 2), beat_period=float(period), beats=beats)
# 16バンド・スペクトラム (対数間隔) → ビルのイコライザー用
edges = np.geomspace(40, 10000, 17)
spec = np.zeros((nfr, 16), np.float32)
for b in range(16):
    m = (freqs >= edges[b]) & (freqs < edges[b + 1])
    e = np.log1p(np.sqrt((S[:, m] ** 2).mean(1)) * 30)
    spec[:, b] = np.clip((e - np.percentile(e, 5)) / (np.percentile(e, 98) - np.percentile(e, 5) + 1e-9), 0, 1.2)
out['spec'] = [[round(float(v), 2) for v in row] for row in spec]
json.dump(out, open(dst, 'w'))
print('frames', nfr, 'bpm', round(bpm, 2), 'beat period frames', period, 'first beat', best)
print('kicks', len(kicks), 'snares', len(snares), 'hats', len(hats))
# 区間ごとの概況 (4秒)
for s in range(0, nfr, 120):
    sl = slice(s, s + 120)
    print(f"{s/FPS:6.1f}s loud={np.mean(out['loud'][sl]):.2f} bass={env['bass'][sl].mean():.2f} mid={env['mid'][sl].mean():.2f} high={env['high'][sl].mean():.2f} kicks={sum(1 for k in kicks if s<=k<s+120)} snr={sum(1 for k in snares if s<=k<s+120)}")
