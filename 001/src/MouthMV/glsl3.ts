import {COMMON, BLDG_VERT} from './glsl';

/** 東京の街の灯り: ビルの壁から通りへ突き出す縦型のネオン看板。字は抽象的な記号(読める文字にはしない) */
export const SIGN_VERT = /* glsl */ `
${COMMON}
${BLDG_VERT}
attribute vec4 aSign;    // 奥行き方向のずれ, 下端の高さ, 看板の高さ, 張り出し幅
attribute vec4 aSign2;   // 色相, 記号の種, 0, 0
varying vec2 vUV; varying vec2 vSz; varying vec4 vS; varying vec3 vW;
void main(){
  Bd b = bldg();
  float side = sign(aInst.x);
  float y0 = aSign.y;
  float Hs = min(aSign.z, b.h*0.92 - y0);
  if (Hs < 2.5) { gl_Position = vec4(3.0, 3.0, 3.0, 1.0); vUV = vec2(0.0); vSz = vec2(1.0); vS = vec4(0.0); vW = vec3(0.0); return; }
  float Wd = aSign.w;
  vec2 q = position.xy + 0.5;
  vec3 w = vec3(b.base.x - side*(aInst.z*0.5 + 0.25 + q.x*Wd), y0 + q.y*Hs, b.base.z + aSign.x);
  vUV = q; vSz = vec2(Wd, Hs); vS = aSign2; vW = w;
  gl_Position = projectionMatrix*viewMatrix*vec4(w,1.0);
}`;

export const SIGN_FRAG = /* glsl */ `
${COMMON}
varying vec2 vUV; varying vec2 vSz; varying vec4 vS; varying vec3 vW;
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }
void main(){
  vec3 V = cameraPosition - vW; float dist = length(V);
  vec2 px = vUV*vSz;
  float border = min(min(px.x, vSz.x-px.x), min(px.y, vSz.y-px.y));
  float tube = exp(-pow((border-0.16)/0.06, 2.0));
  vec3 nc = rainbow(vS.x + uHue*0.35);
  vec3 col = vec3(0.02,0.012,0.04) + nc*0.05;
  // 記号の列(上から): 横画・縦画・斜め・枠を種から組み立てる
  float cw = vSz.x*0.74;
  float n = floor((vSz.y - vSz.x*0.26)/cw);
  vec2 g = vec2((px.x - vSz.x*0.13)/cw, (vSz.y - px.y - vSz.x*0.13)/cw);
  float ci = floor(g.y);
  float s = 1e3;
  if (g.x > 0.0 && g.x < 1.0 && ci >= 0.0 && ci < n) {
    vec2 q = fract(g);
    float sd = vS.y*91.7 + ci*13.37;
    // 漢字のような記号: 横画2〜4本・縦画1〜2本、口(枠)や払いを足す。単独の斜線だけの形(ラテン文字に見える)は作らない
    int nh = 0;
    for (int r = 0; r < 4; r++) {
      float y = 0.14 + 0.24*float(r);
      if (h11(sd + float(r)*7.1) > 0.38 || (r == 1 && nh == 0)) { nh++; float a = 0.10 + 0.22*h11(sd+float(r)*3.3), bb = 0.90 - 0.22*h11(sd+float(r)*5.9); s = min(s, seg(q, vec2(a,y), vec2(bb,y))); }
    }
    float vx = 0.3 + 0.4*h11(sd + 17.0);
    s = min(s, seg(q, vec2(vx, 0.08), vec2(vx, 0.92)));
    if (h11(sd + 31.0) > 0.45) { float x2 = vx > 0.5 ? 0.18 : 0.82; s = min(s, seg(q, vec2(x2, 0.3), vec2(x2, 0.86))); }
    if (h11(sd + 53.0) > 0.55) s = min(s, abs(max(abs(q.x-0.5)*1.25, abs(q.y-0.62)*1.6) - 0.28));   // 口
    if (h11(sd + 71.0) > 0.6) { s = min(s, seg(q, vec2(vx, 0.55), vec2(0.12, 0.9))); s = min(s, seg(q, vec2(vx, 0.55), vec2(0.88, 0.9))); }   // 払い
    s = min(s, seg(q, vec2(0.86, 0.12), vec2(0.86, 0.12)) + 1.0);
    float lit = 0.55 + 0.45*step(0.45, fract(uBeatPos*0.5 + ci*0.19 + vS.y*3.0)) + 0.7*uKick + 0.4*uVoxOn;
    lit *= step(h11(floor(uTime*14.0) + vS.y*57.0 + ci), 0.985);      // ネオン管のまたたき
    float stroke = smoothstep(0.075, 0.035, s);
    float halo = exp(-s*9.0)*0.35;
    col += mix(nc, vec3(1.0), 0.45)*stroke*lit*1.5 + nc*halo*lit;
  }
  col += nc*tube*(1.1 + 0.6*uBeat + 0.9*uKick);
  float fg = 1.0-exp(-dist*0.0032);
  vec3 fogC = rainbow(uHue+0.55+dist*0.0006)*(0.08+0.10*uInten) + vec3(0.015,0.0,0.055);
  gl_FragColor = vec4(min(mix(col, fogC, fg), vec3(2.2)), 1.0);
}`;

/** 通りに渡した提灯とLEDの列。キックで弾む */
export const LANTERN_VERT = /* glsl */ `
${COMMON}
attribute vec4 aL;    // z0, 通りの左右位置 0..1, 吊り高さ, たるみ
attribute vec4 aL2;   // 色相, id, 大きさ, 種類(0=提灯 1=虹色)
varying vec3 vL; varying vec4 vC; varying vec3 vW;
void main(){
  float zz = mod(aL.x - uTravel, uLen);
  float show = smoothstep(uLen*0.92, uLen*0.7, zz);
  float u = aL.y*2.0 - 1.0;
  float a = clamp(uKickAge/9.0, 0.0, 1.0);
  float arc = 4.0*a*(1.0-a);
  float y = aL.z - aL.w*(1.0 - u*u) + arc*0.9*(1.0 - u*u)*(0.6 + 0.6*uInten);
  vec3 p = position*vec3(0.42, 0.56, 0.42)*aL2.z*show;
  vec3 w = vec3(roadX(zz) + u*22.5, y, 34.0 - zz) + p;
  vL = position; vC = aL2; vW = w;
  gl_Position = projectionMatrix*viewMatrix*vec4(w,1.0);
}`;

export const LANTERN_FRAG = /* glsl */ `
${COMMON}
varying vec3 vL; varying vec4 vC; varying vec3 vW;
void main(){
  vec3 V = cameraPosition - vW; float dist = length(V);
  vec3 c = vC.w < 0.5 ? mix(vec3(1.0,0.28,0.08), vec3(1.0,0.72,0.32), step(0.5, fract(vC.y*0.5))) : rainbow(vC.x + uHue);
  float ribs = 0.72 + 0.28*smoothstep(0.2, 0.8, abs(sin(vL.y*11.0)));
  float cap = smoothstep(0.78, 0.86, abs(vL.y));
  vec3 col = c*ribs*(1.25 + 0.7*uBeat + 1.0*uKick + 0.5*uVoxOn);
  col = mix(col, vec3(0.04,0.02,0.02), cap);
  float fg = 1.0-exp(-dist*0.0035);
  vec3 fogC = rainbow(uHue+0.55+dist*0.0006)*(0.08+0.10*uInten) + vec3(0.015,0.0,0.055);
  gl_FragColor = vec4(min(mix(col, fogC, fg), vec3(2.4)), 1.0);
}`;

/** 遠景の電波塔(東京タワー風 / スカイツリー風)。鉄骨の格子をライトアップし、キックで光の輪が昇る */
export const TOWER_VERT = /* glsl */ `
${COMMON}
attribute float aH; attribute float aKind;
varying vec3 vW; varying vec3 vN; varying float vH; varying float vK;
void main(){
  vW = position; vN = normal; vH = aH; vK = aKind;
  gl_Position = projectionMatrix*viewMatrix*vec4(position,1.0);
}`;

export const TOWER_FRAG = /* glsl */ `
${COMMON}
varying vec3 vW; varying vec3 vN; varying float vH; varying float vK;
void main(){
  vec3 V = cameraPosition - vW; float dist = length(V); V /= dist;
  vec3 N = normalize(vN);
  float rim = pow(1.0 - abs(dot(N, V)), 2.0);
  vec3 col;
  if (vK < 0.5) {
    // 東京タワー風: インターナショナルオレンジと白の塗り分けを、暖色のライトアップで照らす
    float band = step(0.5, fract(vH*7.0));
    vec3 paint = mix(vec3(1.0,0.30,0.06), vec3(1.0,0.86,0.70), band);
    col = paint*(0.55 + 0.5*uBass + 0.25*uInten);
  } else {
    // スカイツリー風: 水色(粋)と紫(雅)が4小節ごとに入れ替わる
    float m = smoothstep(0.42, 0.58, abs(fract(uBeatPos/32.0)*2.0 - 1.0));
    col = mix(vec3(0.40,0.72,1.0), vec3(0.72,0.36,1.0), m)*(0.5 + 0.5*uBass + 0.25*uInten);
  }
  col *= 0.75 + 0.5*rim;
  float ring = exp(-pow((vH - uKickAge/22.0)*16.0, 2.0))*step(uKickAge, 22.0);
  col += vec3(1.0,0.95,0.85)*ring*(0.7 + uKick);
  col *= 0.9 + 0.3*uBeat + 0.25*uVoxOn;
  float fg = (1.0 - exp(-dist*0.0012))*0.55;
  vec3 fogC = rainbow(uHue+0.55)*(0.10+0.10*uInten) + vec3(0.02,0.0,0.07);
  gl_FragColor = vec4(min(mix(col, fogC, fg), vec3(2.0)), 1.0);
}`;
