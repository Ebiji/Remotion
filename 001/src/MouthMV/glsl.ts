/** 共有GLSL: ユニフォーム・ノイズ・虹パレット・ビルの挙動(ビルと植物で同一計算) */
export const COMMON = /* glsl */ `
uniform float uTime, uTravel, uLen, uKick, uSnare, uHat, uBass, uMid, uInten, uHue, uBeat, uKickAge, uBeatPos, uKickIdx, uBend;
uniform float uSpec[16];
float h11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
float h21(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec3 rainbow(float h){vec3 c=0.5+0.5*cos(6.28318*(h+vec3(0.0,0.33,0.67))); return c*c*(1.4-0.4*c)*1.25;}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float specAt(float i){
  return uSpec[int(i)];
}
`;

/** ビル(インスタンス)の位置・高さ。イコライザーとして上下する */
export const BLDG_VERT = /* glsl */ `
attribute vec4 aInst;   // x, z0, width, hmax
attribute vec4 aInst2;  // id, depth, band, lane
struct Bd { vec3 base; float h; float zz; float rise; float sp; };
Bd bldg(){
  Bd b;
  float zz = mod(aInst.y - uTravel, uLen);
  b.zz = zz;
  b.rise = smoothstep(uLen, uLen*0.55, zz);
  b.sp = specAt(aInst2.z);
  float side = sign(aInst.x);
  float alt = mod(uKickIdx, 2.0)*2.0 - 1.0;                 // キックごとに左右交互
  float stomp = uKick*(0.35 + 0.65*step(0.0, side*alt));
  float wave = pow(0.5+0.5*cos(6.2832*(uBeatPos*0.5 - b.zz/150.0)), 4.0); // 拍ごとに手前へ走る波
  float eq = pow(clamp(b.sp, 0.0, 1.3), 1.3);
  float m = 0.14 + 0.28*uInten + 1.45*eq*(0.55+0.7*uInten) + 0.85*stomp + 0.6*wave*(0.25+uInten);
  b.h = aInst.w*min(m, 2.5)*b.rise;
  b.base = vec3(aInst.x + uBend*b.zz*b.zz, 0.0, 34.0 - zz);
  return b;
}
`;

export const BUILDING_VERT = /* glsl */ `
${COMMON}
${BLDG_VERT}
varying vec3 vW; varying vec3 vN; varying vec3 vP; varying vec4 vI; varying vec2 vS;
void main(){
  Bd b = bldg();
  vec3 p = position;
  vec3 w = vec3(b.base.x + p.x*aInst.z, p.y*b.h, b.base.z + p.z*aInst2.y);
  vW = w; vN = normal; vP = position; vI = vec4(aInst2.x, b.zz, b.sp, b.h); vS = vec2(aInst.z, aInst2.y);
  gl_Position = projectionMatrix*viewMatrix*vec4(w,1.0);
}`;

export const BUILDING_FRAG = /* glsl */ `
${COMMON}
varying vec3 vW; varying vec3 vN; varying vec3 vP; varying vec4 vI; varying vec2 vS;
float carpet(vec2 c){
  for(int i=0;i<4;i++){ vec2 m=mod(floor(c),3.0); if(m.x==1.0&&m.y==1.0) return 0.0; c=floor(c/3.0); }
  return 1.0;
}
void main(){
  vec3 N = normalize(vN);
  float id = vI.x, sp = vI.z;
  vec3 V = cameraPosition - vW; float dist = length(V); V /= dist;
  vec3 hueC = rainbow(id*0.173 + uHue);
  vec3 col = hueC*0.018 + vec3(0.012,0.008,0.03);
  float edgeGlow = 0.0;
  if (N.y > 0.5) {
    // 屋上: ネオンの縁取り + 同心の幾何パターン
    vec2 q = vP.xz; float e = min(0.5-abs(q.x), 0.5-abs(q.y)) ;
    float ew = min((0.5-abs(q.x))*vS.x, (0.5-abs(q.y))*vS.y);
    edgeGlow = exp(-ew*2.2);
    float grid = smoothstep(0.06,0.0,abs(fract(ew*0.35)-0.5)-0.44);
    col += rainbow(id*0.31+uHue+ew*0.05)*(edgeGlow*0.5 + grid*0.05*(0.4+uInten))*smoothstep(260.0,60.0,dist);
  } else if (abs(N.y) < 0.5) {
    float faceW = abs(N.x) > 0.5 ? vS.y : vS.x;
    float u = ((abs(N.x) > 0.5 ? vP.z*sign(N.x) : -vP.x*sign(N.z)) + 0.5) * faceW;
    float v = vW.y;
    vec2 cs = vec2(1.25, 2.1);
    vec2 cell = floor(vec2(u/cs.x + id*3.0, v/cs.y));
    vec2 f = fract(vec2(u/cs.x + id*3.0, v/cs.y));
    float car = carpet(cell);
    float r = h21(cell + id*7.13);
    // 窓
    float win = smoothstep(0.14,0.2,f.x)*smoothstep(0.86,0.8,f.x)*smoothstep(0.16,0.22,f.y)*smoothstep(0.84,0.78,f.y);
    float wave = 0.5+0.5*sin(cell.y*0.42 - uTime*2.4 + id*2.0 + cell.x*0.7);
    float lit = step(0.45 - 0.25*uInten, r*0.9 + wave*0.35 - 0.1);
    vec3 wc = rainbow(id*0.37 + cell.y*0.03 + r*0.12 + uHue);
    float glass = 0.55 + 0.9*(1.0-f.y);
    col += rainbow(uHue+0.62+v*0.004)*win*car*0.07*glass;
    col += wc*win*car*glass*(0.04 + 1.05*lit*(0.45+sp*0.9+uHat*0.4)*(0.6+0.8*r));
    // フラクタル(シェルピンスキーカーペット)の穴 = 発光パネル
    float hole = (1.0-car);
    float stripes = 0.5+0.5*sin(v*1.6 - uTime*5.0 + u*0.9);
    vec3 pc = rainbow(v*0.012 + id*0.2 + uHue*1.0 + stripes*0.15);
    col += pc*hole*win*(0.12 + 0.55*stripes)*(0.5+uInten);
    // キックで駆け上がる光のリング
    float sweepY = uKickAge*7.0;
    float sw = exp(-pow((v - sweepY)*0.09,2.0));
    col += rainbow(v*0.01+uHue+0.3)*sw*(0.05+0.55*uKick)*(0.5+0.5*car)*step(uKickAge, 40.0);
    // 縦のコーナーネオン + 階層ライン
    float de = min(u, faceW-u);
    col += rainbow(id*0.37+uHue+0.5)*exp(-de*2.5)*(0.4+0.9*sp);
    float fl = abs(fract(v/14.0)-0.5);
    col += rainbow(v*0.01+id+uHue)*smoothstep(0.47,0.5,fl)*0.35*(0.4+uInten);
  } else {
    col = vec3(0.0);
  }
  float rim = pow(1.0-max(dot(N,V),0.0), 3.0);
  col += rainbow(uHue+dist*0.003)*rim*0.10;
  // フォグ(加算ヘイズ)
  float fg = 1.0-exp(-dist*0.0046);
  vec3 fogC = rainbow(uHue+0.55+dist*0.0006)*(0.07+0.10*uInten) + vec3(0.012,0.0,0.035);
  col = mix(col, fogC, fg);
  gl_FragColor = vec4(min(col, vec3(1.7)),1.0);
}`;

export const GROUND_VERT = /* glsl */ `
varying vec3 vW;
uniform vec3 uCamPos;
void main(){ vec3 w = position + vec3(0.0,0.0,uCamPos.z); w.x += uCamPos.x; vW=w; gl_Position = projectionMatrix*viewMatrix*vec4(w,1.0); }`;

export const GROUND_FRAG = /* glsl */ `
${COMMON}
varying vec3 vW;
void main(){
  vec3 V = cameraPosition - vW; float dist = length(V);
  float z = vW.z + uTravel;                 // 流れる座標
  float zg = max(34.0 - vW.z, 0.0);
  float x = vW.x - uBend*zg*zg;
  vec3 col = vec3(0.012,0.008,0.03);
  // 道路 (ストリート幅14)
  float road = smoothstep(15.0,14.0,abs(x));
  // レーン線(虹) + 横断バー
  float lane = exp(-pow((abs(x)-6.0)*1.3,2.0)) + exp(-pow(x*1.3,2.0))*step(0.5,fract(z*0.05));
  float bars = smoothstep(0.04,0.0,abs(fract(z/12.0)-0.5)-0.46);
  vec3 lc = rainbow(z*0.004 + uHue + abs(x)*0.02);
  col += lc*(lane*0.8 + bars*0.35)*(0.5+0.8*uInten)*road;
  // 全域のネオングリッド
  float gx = smoothstep(0.05,0.0,abs(fract(x/10.0)-0.5)-0.46);
  float gz = smoothstep(0.05,0.0,abs(fract(z/10.0)-0.5)-0.46);
  col += rainbow(uHue+z*0.002)*max(gx,gz)*0.10;
  // キックの衝撃波リップル
  float rr = uKickAge*5.5;
  float d2 = length(vec2(x, vW.z - 0.0));
  col += rainbow(d2*0.01+uHue)*exp(-pow((d2-rr)*0.18,2.0))*0.7*step(uKickAge,50.0)*(1.0-uKickAge/60.0);
  // フォグ
  float fg = 1.0-exp(-dist*0.0046);
  vec3 fogC = rainbow(uHue+0.55+dist*0.0006)*(0.07+0.10*uInten) + vec3(0.012,0.0,0.035);
  col = mix(col, fogC, fg);
  gl_FragColor = vec4(min(col, vec3(1.6)),1.0);
}`;

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix*viewMatrix*vec4(position+cameraPosition,1.0); gl_Position.z = gl_Position.w*0.9999; }`;

export const SKY_FRAG = /* glsl */ `
${COMMON}
varying vec3 vDir;
uniform vec3 uHeroDir;
uniform float uKal;
float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
float n3(vec3 p){
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float a=h31(i), b=h31(i+vec3(1,0,0)), c=h31(i+vec3(0,1,0)), d=h31(i+vec3(1,1,0));
  float e=h31(i+vec3(0,0,1)), g=h31(i+vec3(1,0,1)), h=h31(i+vec3(0,1,1)), k=h31(i+vec3(1,1,1));
  return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y), mix(mix(e,g,f.x),mix(h,k,f.x),f.y), f.z);
}
float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*n3(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  vec3 hc = normalize(uHeroDir);
  vec3 rt = normalize(cross(hc, vec3(0.0,1.0,0.0)));
  vec3 up2 = cross(rt, hc);
  float cz = dot(d,hc);
  vec2 q = vec2(dot(d,rt), dot(d,up2)) / max(cz, 0.2);
  float el = d.y;
  // 星雲 (ドメインワープしたfbm)
  vec3 q3 = d*2.4 + vec3(0.0,0.0,uTime*0.025);
  vec3 wv = vec3(fbm(q3*1.4+uTime*0.03), fbm(q3*1.4+7.1), fbm(q3*1.4+3.3));
  float w = fbm(q3 + 1.6*wv);
  vec3 neb = rainbow(uHue + w*1.1 + el*0.35)*pow(w,2.4)*2.2;
  vec3 col = mix(vec3(0.004,0.0,0.03), rainbow(uHue+0.62)*0.10, smoothstep(0.9,-0.1,el));
  col += neb*(0.35+0.4*uInten)*smoothstep(-0.15,0.45,el);
  // 地平線のグロー
  float hor = exp(-pow(el*5.0,2.0));
  col += rainbow(uHue + 0.15 + atan(d.x,-d.z)*0.1)*hor*(0.22+0.25*uInten+0.2*uKick);
  // 曼荼羅フラクタル (巨大花の背後に広がるKali集合 + 万華鏡フォールド)
  float seg = 6.2831853/(6.0 + 2.0*floor(uKal));
  float r = length(q);
  float a = atan(q.y,q.x) + uTime*0.05;
  a = abs(mod(a,seg)-seg*0.5);
  vec2 p = r*vec2(cos(a),sin(a))*(1.5 - 0.2*uKick);
  vec2 c = vec2(0.86+0.06*sin(uTime*0.13), 0.46+0.05*cos(uTime*0.17));
  float trap = 1e3, trap2 = 1e3; vec2 z = p;
  for(int i=0;i<9;i++){
    float m = max(dot(z,z), 1e-3);
    z = abs(z)/m - c;
    trap = min(trap, abs(z.x*0.9 + z.y*0.4));
    trap2 = min(trap2, length(z));
  }
  float lines = exp(-trap*4.0), web = exp(-trap2*1.6);
  vec3 mand = rainbow(trap2*0.6 + r*0.35 + uHue*1.5)*(lines*1.1 + web*0.35);
  float mmask = smoothstep(2.8, 0.6, r)*step(0.0, cz);
  col += mand*mmask*(0.16+0.2*uInten);
  float ring = exp(-pow((fract(r*2.2 - uTime*0.15)-0.5)*8.0,2.0));
  col += rainbow(r + uHue)*ring*0.12*(0.4+uInten)*mmask;
  // 星
  vec3 sd = floor(d*230.0); float sr = h21(sd.xy+sd.z*17.0);
  col += vec3(1.0)*step(0.9985,sr)*(0.5+0.5*sin(uTime*3.0+sr*60.0))*smoothstep(0.0,0.3,el);
  gl_FragColor = vec4(min(col, vec3(2.0)),1.0);
}`;
