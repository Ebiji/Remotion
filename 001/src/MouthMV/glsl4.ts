import {COMMON} from './glsl';

/** 雪のための共有関数: 値ノイズ・雪面の色・きらめき */
export const SNOWLIB = /* glsl */ `
float vn2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm2(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*vn2(p); p=p*2.07+vec2(3.1,7.7); a*=0.5; } return s; }
/** 雪面: 青みの白 + 街のネオンの映り込み */
vec3 snowCol(vec2 p, float shade){
  float n = fbm2(p*0.6);
  return vec3(0.56,0.66,0.86)*(0.72 + 0.28*n)*(0.55 + 0.45*shade) + rainbow(uHue + n*0.4 + p.y*0.004)*0.07;
}
/** 雪の粒のきらめき(ところどころ、拍で瞬く) */
float glint(vec2 p, float dens){
  vec2 c = floor(p); float r = h21(c);
  float on = step(1.0 - dens, r);
  float tw = 0.5 + 0.5*sin(uTime*7.0 + r*60.0);
  return on*tw*smoothstep(0.35, 0.0, length(fract(p) - 0.5))*(0.6 + 0.8*uHat + 0.6*uKick);
}
`;

/** 中央の巨大な雪の結晶: 6回対称の樹枝状結晶(フラクタルに枝分かれ) + 六角板 + 薄膜の虹色 */
export const FLAKE_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vWp;
void main(){ vUv = uv*2.0-1.0; vec4 wp = modelMatrix*vec4(position,1.0); vWp = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`;

export const FLAKE_FRAG = /* glsl */ `
${COMMON}
uniform float uGrow, uSpin, uHueOff, uDetail;
varying vec2 vUv; varying vec3 vWp;
float sdSeg(vec2 p, vec2 a, vec2 b, float r0, float r1){
  vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
  return length(pa-ba*h) - mix(r0, r1, h);
}
void main(){
  vec2 p = vUv*1.08;
  p = rot(uSpin)*p;
  float r = length(p);
  if (r > 1.08) discard;
  // 6回対称: 60度ごとに折り畳み、鏡映で30度の扇形へ
  float a = atan(p.y, p.x);
  float S = 1.0471976;
  float k = floor(a/S + 0.5);
  a = abs(a - k*S);
  vec2 q = r*vec2(cos(a), sin(a));
  float L = 0.93*uGrow;
  // 主軸(幹)
  float th = 0.030;
  float d = sdSeg(q, vec2(0.0), vec2(L, 0.0), th, th*0.45);
  float trap = 1e3;
  // 枝分かれ: 各段で一番近い枝を選び、60度に開いた子の枝へ入っていく(フラクタル)
  vec2 z = q; float len = L; float per = 0.17; float w = th*0.78; float lvl = 0.0;
  for (int i = 0; i < 4; i++) {
    float on = smoothstep(float(i) - 0.2, float(i) + 0.6, uDetail);
    if (on < 0.01) break;
    float x0 = clamp(floor(z.x/per + 0.5)*per, per*0.9, len*0.92);
    vec2 b = z - vec2(x0, 0.0);
    b.y = abs(b.y);
    b = rot(1.0471976)*b;          // 60度の枝を+x方向へ
    float bl = (len - x0)*(0.62 - 0.08*float(i))*on*(1.0 + 0.25*uKick);
    float db = sdSeg(b, vec2(0.0), vec2(bl, 0.0), w, w*0.4);
    d = min(d, db);
    trap = min(trap, abs(b.y) + 0.3*abs(b.x - bl*0.5));
    z = b; len = bl; per *= 0.48; w *= 0.62; lvl += on;
  }
  // 中心の六角板(同心の六角の筋) と 先端の小さな六角板
  float hexD = dot(q, vec2(0.8660254, 0.5));
  float plateR = 0.22*uGrow*(1.0 + 0.12*uBass);
  float plate = hexD - plateR;
  float rings = abs(fract(hexD/plateR*3.0 - uTime*0.4) - 0.5);
  vec2 tq = q - vec2(L*0.97, 0.0);
  float tip = dot(abs(vec2(tq.x, tq.y)), vec2(0.8660254, 0.5)) - 0.055*uGrow;
  float body = min(d, min(plate, tip));
  float aa = 0.006;
  float fill = smoothstep(aa, -aa, body);
  float edge = smoothstep(0.018, 0.0, abs(body));
  float halo = exp(-max(body, 0.0)*26.0);
  // 氷の面: 扇形の角度でファセット、稜線(主軸と30度線)が光る
  float facet = 0.55 + 0.45*cos(a*6.0 + r*9.0 - uTime*0.7);
  float ridge = exp(-abs(q.y)*90.0)*step(r, L) + exp(-abs(a - 0.5236)*r*90.0)*step(r, plateR*1.25);
  vec3 ice = vec3(0.93, 0.965, 1.0)*(0.70 + 0.30*facet);   // 白が基調
  // 薄膜の干渉色(虹色)が縁と板の筋に乗る
  float film = r*2.6 + hexD*3.0 + uTime*0.05 + uHueOff;
  vec3 irid = mix(vec3(0.659, 0.847, 0.941), vec3(0.498, 0.722, 0.902), 0.5 + 0.5*sin(film*6.0));   // 縁はアイスブルー
  vec3 col = ice*fill*(0.95 + 0.15*uBeat + 0.2*uKick);   // 静かに
  col += irid*edge*(1.3 + 0.4*uInten + 0.4*uVoxOn);
  col += vec3(1.0)*ridge*fill*(0.5 + 0.6*uKick);
  col += irid*smoothstep(0.08, 0.0, rings)*step(plate, 0.0)*0.6;
  col += vec3(0.659, 0.847, 0.941)*exp(-trap*30.0)*fill*0.35*(0.5 + uInten);
  col += vec3(0.498, 0.722, 0.902)*halo*(0.15 + 0.15*uInten + 0.1*uKick)*(1.0 - fill);
  // 結晶のきらめき
  vec2 gp = q*60.0; float gr = h21(floor(gp));
  col += vec3(1.0)*step(0.985, gr)*fill*(0.5 + 0.5*sin(uTime*9.0 + gr*80.0))*(0.8 + 1.5*uHat);
  float alpha = clamp(fill*0.92 + edge*0.6 + halo*0.35, 0.0, 1.0);
  gl_FragColor = vec4(min(col, vec3(2.2)), alpha);
}`;

/** 降る雪: 六花の形の粒。キックで渦を巻き、近いほど大きくボケる */
export const SNOW_VERT = /* glsl */ `
${COMMON}
attribute vec4 aSeed;
uniform float uPx, uFall;
varying float vA; varying float vRot; varying float vSize; varying vec3 vC; varying float vLayer;
void main(){
  vec3 s = aSeed.xyz;
  // 3層: 手前=大きくぼけた雪片(12%) / 中景=標準(38%) / 奥=細かい粉雪(50%)
  float layer = aSeed.w < 0.12 ? 0.0 : (aSeed.w < 0.5 ? 1.0 : 2.0);
  float z0 = layer < 0.5 ? 3.0 : (layer < 1.5 ? 10.0 : 35.0);
  float z1 = layer < 0.5 ? 26.0 : (layer < 1.5 ? 110.0 : uLen*0.62);
  float zz = z0 + mod(s.z*(z1 - z0) - uTravel*0.9, z1 - z0);
  float H = 70.0;
  float sp = (layer < 0.5 ? 1.5 : (layer < 1.5 ? 1.15 : 0.85))*(0.8 + 0.4*fract(aSeed.w*7.3));   // ゆっくり
  float y = mod(s.y*H - uTime*sp, H) - 2.0;
  float x = (s.x - 0.5)*(70.0 + zz*0.9) + roadX(zz);
  x += sin(uTime*0.35 + s.y*12.0)*1.3 + sin(uTime*0.9 + s.z*20.0)*0.35;   // 風でわずかに揺れる
  vec4 mv = viewMatrix*vec4(x, y, 34.0 - zz, 1.0);
  gl_Position = projectionMatrix*mv;
  float show = step(h11(aSeed.w*71.3 + s.x*13.0), uFall);
  float sz = layer < 0.5 ? 3.2 + 1.8*s.x : (layer < 1.5 ? 1.0 + 0.5*s.x : 0.45 + 0.25*s.x);
  gl_PointSize = clamp(sz*uPx*190.0/ -mv.z, 1.2, 40.0*uPx)*show;
  vSize = gl_PointSize; vLayer = layer;
  vRot = s.x*6.28 + uTime*0.4*(s.y > 0.5 ? 1.0 : -1.0);
  vA = show*smoothstep(z1, z1 - (z1 - z0)*0.25, zz)*smoothstep(z0, z0 + 3.0, zz)*smoothstep(-2.0, 3.0, y)*(layer < 0.5 ? 0.38 : (layer < 1.5 ? 0.85 : 0.6));
  vC = mix(vec3(1.0), vec3(0.933, 0.965, 1.0), s.y);
}`;
export const SNOW_FRAG = /* glsl */ `
${COMMON}
varying float vA; varying float vRot; varying float vSize; varying vec3 vC; varying float vLayer;
void main(){
  vec2 c = gl_PointCoord*2.0 - 1.0;
  c = rot(vRot)*c;
  float r = length(c);
  if (r > 1.0 || vA < 0.01) discard;
  float m;
  if (vLayer < 0.5) {
    m = smoothstep(1.0, 0.75, r)*(0.55 + 0.45*smoothstep(0.55, 0.95, r));   // ぼけた円(縁が少し明るい)
  } else if (vLayer < 1.5) {
    float a = atan(c.y, c.x);
    float arms = pow(abs(cos(a*3.0)), 18.0)*smoothstep(1.0, 0.15, r);
    float star = clamp(arms + exp(-r*r*14.0), 0.0, 1.0);
    m = mix(exp(-r*r*4.0)*(1.0 - r), star, smoothstep(9.0, 22.0, vSize));
  } else {
    m = exp(-r*r*5.0)*(1.0 - r);
  }
  float al = m*vA;
  gl_FragColor = vec4(vC*al*0.9, al);
}`;

/** 雪だるま: 3段の雪玉・炭の目とボタン・人参の鼻・枝の腕・帽子・マフラー。
 * 作られる(下から順に固まる) → 拍で踊る → 溶ける(つぶれて広がる) */
export const MAN_VERT = /* glsl */ `
${COMMON}
attribute vec4 aMan;     // 左右, z0, 大きさ, id
attribute float aPart;   // 0=雪 1=炭 2=人参 3=枝 4=帽子 5=マフラー
attribute vec3 aCtr;     // 部品の中心(腕は肩の位置)
uniform float uMan, uMelt;
varying vec3 vN; varying float vPart; varying vec3 vW; varying float vId; varying float vMelt; varying vec3 vP;
void main(){
  float zz = mod(aMan.y - uTravel, uLen);
  float rise = smoothstep(uLen, uLen*0.62, zz);
  float id = aMan.w;
  float side = aMan.x;
  // 作られる: 1体ずつ時間差で、下の雪玉から順に
  float delay = h11(id*7.31)*0.45;
  float built = smoothstep(delay, delay + 0.4, uMan);
  float hy = aCtr.y/4.3;
  float stage = smoothstep(hy*0.55, hy*0.55 + 0.45, built);
  vec3 p = position; vec3 n = normal;
  p = aCtr + (p - aCtr)*stage;
  // 腕を振る(スネアと声で)
  if (aPart > 2.5 && aPart < 3.5) {
    float sd = sign(aCtr.x);
    float wave = 0.55*sin(uTime*5.0 + id*3.0)*(0.25 + uSnare + 0.8*uVoxOn) + 0.5*uKick*sd;
    vec2 o = p.xy - aCtr.xy; o = rot(wave*sd)*o; p.xy = aCtr.xy + o;
    n.xy = rot(wave*sd)*n.xy;
  }
  // 頭を拍で揺らす
  if (aCtr.y > 3.2) { float bob = sin(uBeatPos*3.14159 + id)*0.12*(0.4 + uInten); p.x += bob*(p.y - 2.9); }
  // 溶ける: 背が縮み、すそが広がって水たまりへ
  float m = clamp(uMelt*1.25 - h11(id*3.1)*0.25, 0.0, 1.0);
  vMelt = m;
  float sq = 1.0 - 0.9*m;
  float spread = 1.0 + 1.1*m*smoothstep(2.4, 0.0, p.y*sq);
  p.y *= sq;
  p.xz *= spread;
  p.x += sin(p.y*2.6 + id*5.0 + uTime*0.8)*0.18*m;
  n.y += m*0.8;
  // 踊る: キックごとに半分ずつ交互に跳ね、着地で潰れる。体を左右に揺らす
  float grp = step(0.5, h11(id*3.7));
  float onG = mix(0.35, 1.0, 1.0 - abs(grp - mod(uKickIdx, 2.0)));
  float ka = clamp(uKickAge/10.0, 0.0, 1.0);
  float arc = 4.0*ka*(1.0 - ka)*step(uKickAge, 10.0);
  float land = exp(-pow((uKickAge - 10.0)*0.45, 2.0));
  float st = (0.14*arc - 0.12*land)*(1.0 - m);
  p = vec3(p.x*(1.0 - st*0.5), p.y*(1.0 + st), p.z*(1.0 - st*0.5));
  float sway = sin(uBeatPos*3.14159 + id*2.0)*0.10*(0.3 + uInten)*(1.0 - m);
  p.xy = rot(sway)*p.xy; n.xy = rot(sway)*n.xy;
  float yaw = -side*0.55 + (h11(id*5.7) - 0.5)*0.6;
  p.xz = rot(yaw)*p.xz; n.xz = rot(yaw)*n.xz;
  float sc = aMan.z*rise*step(0.001, built);
  vec3 w = vec3(roadX(zz) + side*(19.0 + h11(id*9.1)*2.0), 0.0, 34.0 - zz) + p*sc;
  w.y += arc*1.6*onG*(0.6 + 0.6*uInten)*(1.0 - m)*sc;
  vN = n; vPart = aPart; vW = w; vId = id; vP = position;
  gl_Position = projectionMatrix*viewMatrix*vec4(w, 1.0);
}`;
export const MAN_FRAG = /* glsl */ `
${COMMON}
${SNOWLIB}
varying vec3 vN; varying float vPart; varying vec3 vW; varying float vId; varying float vMelt; varying vec3 vP;
void main(){
  vec3 N = normalize(vN);
  vec3 V = cameraPosition - vW; float dist = length(V); V /= dist;
  vec3 L = normalize(vec3(0.3, 0.9, 0.45));
  float ndl = 0.5 + 0.5*dot(N, L);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);
  vec3 neon = rainbow(uHue + vId*0.37 + vW.y*0.02);
  vec3 col;
  if (vPart < 0.5) {
    // 雪: やわらかい陰影 + 内側に回る青い光 + ネオンの縁取り + きらめき
    float sss = pow(max(dot(-N, L), 0.0), 1.2);
    col = vec3(0.60, 0.70, 0.90)*(0.38 + 0.52*ndl) + vec3(0.10, 0.18, 0.40)*sss;
    col *= 0.9 + 0.1*fbm2(vP.xy*6.0 + vP.z*3.0);
    col += neon*rim*(0.55 + 0.8*uKick + 0.4*uBeat);
    col += vec3(1.0)*glint(vP.xy*30.0 + vP.z*17.0, 0.03)*0.8;
    // 溶けかけ: つやと半透明の青み
    float spec = pow(max(dot(reflect(-L, N), V), 0.0), 40.0);
    col = mix(col, vec3(0.30, 0.45, 0.75)*(0.5 + 0.5*ndl) + spec*1.2, vMelt*0.6);
  } else if (vPart < 1.5) {
    float spec = pow(max(dot(reflect(-L, N), V), 0.0), 30.0);
    col = vec3(0.02, 0.02, 0.03) + vec3(0.9)*spec + neon*rim*0.25;
  } else if (vPart < 2.5) {
    col = vec3(1.0, 0.42, 0.08)*(0.35 + 0.65*ndl) + vec3(1.0, 0.7, 0.3)*rim*0.4;
  } else if (vPart < 3.5) {
    float groove = 0.7 + 0.3*sin(vP.x*60.0 + vP.y*20.0);
    col = vec3(0.22, 0.12, 0.06)*(0.4 + 0.6*ndl)*groove + neon*rim*0.3;
  } else if (vPart < 4.5) {
    float band = smoothstep(0.03, 0.0, abs(vP.y - 4.02) - 0.05);
    col = rainbow(vId*0.53 + 0.6)*0.10*(0.4 + 0.6*ndl) + neon*band*(0.9 + 0.8*uBeat) + neon*rim*0.3;
  } else {
    float stripe = step(0.5, fract(atan(vP.z, vP.x)*2.0 + vP.y*3.0));
    vec3 sc = rainbow(vId*0.71 + uHue*0.5 + stripe*0.35);
    col = sc*(0.35 + 0.65*ndl)*(0.9 + 0.5*uBeat + 0.4*uVoxOn) + sc*rim*0.4;
  }
  float fg = 1.0 - exp(-dist*0.0046);
  vec3 fogC = rainbow(uHue + 0.55 + dist*0.0006)*(0.08 + 0.10*uInten) + vec3(0.015, 0.0, 0.055);
  gl_FragColor = vec4(min(mix(col, fogC, fg), vec3(2.0)), 1.0);
}`;
