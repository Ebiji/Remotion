import {COMMON, BLDG_VERT} from './glsl';

export const PLANT_VERT = /* glsl */ `
${COMMON}
${BLDG_VERT}
attribute vec3 aStart; attribute vec4 aMeta; attribute vec2 aUV; attribute vec4 aWall;
uniform float uPlant;
varying vec3 vW; varying vec3 vN; varying vec4 vM; varying vec2 vUV; varying float vSp;
void main(){
  Bd b = bldg();
  float rnd = h11(aInst2.x*17.3 + 1.7);
  float G = uPlant*(0.45 + 0.95*rnd) + 0.10*uKick*uPlant;
  G *= smoothstep(uLen*0.78, uLen*0.34, b.zz);             // 近づくほど芽吹く
  float g = clamp((G - aMeta.x)/max(aMeta.y-aMeta.x, 0.001), 0.0, 1.0);
  g = g*g*(3.0-2.0*g);
  vec3 p = aStart + (position - aStart)*g;
  vec3 n = normal;
  // 花は拍で脈動
  if (aMeta.w > 1.5 && aMeta.w < 2.5) { vec3 c0 = aStart; p = c0 + (p - c0)*(1.0 + 0.45*uKick + 0.12*uBeat + 0.25*uSnare); }
  float mode = aWall.x;
  float s = (0.8 + 0.9*rnd) * (0.8 + 0.5*aInst.z/12.0) * (mode < 0.5 ? 1.25 : (mode < 1.5 ? 0.8 : 1.1));
  // 風のうねり
  float ph = uTime*1.6 + aInst2.x*6.28 + p.y*0.45;
  p.x += sin(ph)*p.y*0.045*(1.0+uBass*1.5);
  p.z += cos(ph*0.8)*p.y*0.04*(1.0+uBass*1.5);
  float ang = aInst2.x*37.0; mat2 R = rot(ang);
  p.xz = R*p.xz; n.xz = R*n.xz;
  p *= s;
  vec3 anchor;
  if (mode < 0.5) {            // 屋上
    vec2 off = vec2(h11(aInst2.x*5.1)-0.5, h11(aInst2.x*9.3)-0.5) * vec2(aInst.z, aInst2.y)*0.45;
    anchor = vec3(b.base.x + off.x, b.h, b.base.z + off.y);
  } else if (mode < 1.5) {     // 壁面から通りへ張り出す
    float sd = aWall.w;
    p = vec3(-sd*p.y, p.x, p.z); n = vec3(-sd*n.y, n.x, n.z);
    anchor = vec3(aInst.x - sd*aInst.z*0.5, b.h*aWall.y, b.base.z + aWall.z*aInst2.y);
  } else {                     // 歩道の街路樹
    anchor = vec3(aInst.x, 0.0, b.base.z);
  }
  vec3 w = anchor + p;
  vW = w; vN = n; vM = aMeta; vUV = aUV; vSp = b.sp;
  gl_Position = projectionMatrix*viewMatrix*vec4(w,1.0);
}`;

export const PLANT_FRAG = /* glsl */ `
${COMMON}
varying vec3 vW; varying vec3 vN; varying vec4 vM; varying vec2 vUV; varying float vSp;
void main(){
  vec3 N = normalize(vN); if(!gl_FrontFacing) N = -N;
  vec3 V = cameraPosition - vW; float dist = length(V); V/=dist;
  float kind = vM.w;
  float fres = 1.0-max(dot(N,V),0.0);
  float hue = vM.z + uHue + vW.y*0.0015 + fres*0.3 + vUV.y*0.08;
  vec3 base = rainbow(hue);
  float ndl = 0.5+0.5*dot(N, normalize(vec3(0.35,0.85,0.4)));
  float rim = pow(1.0-max(dot(N,V),0.0), 2.2);
  vec3 col = base*(0.10 + 0.50*ndl);
  col += rainbow(hue+0.12)*pow(rim,3.0)*(0.3+0.2*uInten);
  if (kind > 0.5 && kind < 1.5) {          // 葉: 葉脈
    float vein = smoothstep(0.08,0.0,abs(vUV.x-0.5)-0.01) + smoothstep(0.06,0.0,abs(fract(vUV.y*7.0+abs(vUV.x-0.5)*3.0)-0.5)-0.43)*0.5;
    col += rainbow(hue+0.5)*vein*0.45*(0.5+uInten);
  } else if (kind > 1.5) {                 // 花弁: 根元は温かく先端は虹、縁に光の粒
    float tip = vUV.y;
    col = rainbow(hue + tip*0.35)*(0.18+0.8*ndl) + rainbow(hue+tip*0.35+0.12)*rim*0.3;
    col += vec3(1.0,0.5,0.2)*pow(1.0-tip,5.0)*0.18;
    float dots = smoothstep(0.13,0.0,length(vec2(vUV.x-0.5, fract(tip*5.0)-0.5)*vec2(1.6,0.9)));
    col += rainbow(hue+0.2)*dots*0.2;
    col *= 1.0 + 0.45*uKick + 0.2*uBeat;
  } else {                                 // 茎: 流れる光
    float flow = 0.5+0.5*sin(vUV.y*30.0 - uTime*6.0 + vM.z*20.0);
    col += rainbow(hue+0.2)*flow*0.07*(0.3+uInten);
  }
  float fg = 1.0-exp(-dist*0.0046);
  vec3 fogC = rainbow(uHue+0.55+dist*0.0006)*(0.07+0.10*uInten) + vec3(0.012,0.0,0.035);
  col = mix(col, fogC, fg);
  gl_FragColor = vec4(min(col, vec3(1.7)), 1.0);
}`;

/** 巨大曼荼羅花 (フィボナッチ花弁) */
export const HERO_VERT = /* glsl */ `
${COMMON}
attribute float aN;       // 花弁の番号
uniform float uBloom, uSpin, uTotal, uHueOff;
varying vec3 vNn; varying vec2 vUV; varying float vF; varying vec3 vWp;
void main(){
  float f = (aN+0.5)/uTotal;
  float ang = aN*2.399963 + uSpin;
  float R = 100.0;
  float rad = sqrt(f)*R*0.62;
  vec2 rd = vec2(cos(ang), sin(ang));
  // 内側から順に開花
  float open = smoothstep(f*0.75, f*0.75+0.35, uBloom*1.2);
  float el = mix(1.38, 0.10 + 0.45*(1.0-f), open) + 0.06*sin(uTime*2.0 + aN*0.3) + 0.22*uKick*(1.0-f);
  vec3 radial = vec3(rd, 0.0);
  vec3 fwd = normalize(radial*cos(el) + vec3(0.0,0.0,sin(el)));
  vec3 side = vec3(-rd.y, rd.x, 0.0);
  float len = R*(0.12 + 0.66*pow(f,0.6))*(0.30+0.70*open);
  float wid = len*0.27;
  float v = uv.y; float u = uv.x*2.0-1.0;
  float prof = pow(sin(3.14159*min(1.0,0.10+v*0.9)), 0.75);
  vec3 dirv = fwd;
  vec3 pos = vec3(rad*rd, 0.0) + dirv*(v*len);
  pos.z -= 0.35*len*v*v*(1.0-0.5*open);   // 弓なりに反る
  pos += side*(u*wid*prof);
  pos.z += u*u*wid*0.35*prof*v;            // 花弁の窪み
  vec3 nn = normalize(cross(side, dirv));
  vNn = normalize(mat3(modelMatrix)*nn); vUV = vec2(u, v); vF = f;
  vec4 wp = modelMatrix*vec4(pos,1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix*viewMatrix*wp;
}`;

export const HERO_FRAG = /* glsl */ `
${COMMON}
uniform float uHueOff;
varying vec3 vNn; varying vec2 vUV; varying float vF; varying vec3 vWp;
void main(){
  vec3 N = normalize(vNn); if(!gl_FrontFacing) N=-N;
  vec3 V = normalize(cameraPosition - vWp);
  float rim = pow(1.0-max(dot(N,V),0.0), 2.0);
  vec2 p = vec2(vUV.x*0.6, vUV.y*1.1);
  // 花弁の中のIFSフラクタル (折り畳み)
  float acc = 0.0; float tr = 1e3;
  for(int i=0;i<4;i++){
    p = abs(p) - vec2(0.17, 0.10);
    p *= rot(0.55 + 0.1*sin(uTime*0.3 + float(i)));
    p *= 1.55;
    tr = min(tr, abs(p.x*p.y));
    acc += exp(-length(p)*1.3);
  }
  float lines = exp(-tr*5.0);
  float hue = vF*1.15 + vUV.y*0.28 + uHue + uHueOff;
  vec3 base = rainbow(hue);
  vec3 col = base*(0.18 + 0.35*(0.5+0.5*dot(N,normalize(vec3(0.3,0.5,0.8)))));
  col += rainbow(hue+0.35)*lines*(1.0+1.4*uKick);
  col += rainbow(hue+0.15)*acc*0.12;
  col += rainbow(hue+0.5)*rim*1.0;
  col += vec3(1.0,0.9,0.8)*pow(1.0-vUV.y,6.0)*0.35*(1.0-vF);
  col *= 0.8 + 0.35*uBeat + 0.45*uKick;
  // 先端の発光
  col += rainbow(hue+0.2)*smoothstep(0.9,1.0,vUV.y)*0.6;
  float edge = smoothstep(1.0,0.55,abs(vUV.x));
  col *= 0.25 + 0.75*edge;
  col += rainbow(hue+0.6)*smoothstep(0.78,1.0,abs(vUV.x))*0.5*(0.5+uInten);
  gl_FragColor = vec4(min(col, vec3(2.0)), 1.0);
}`;

export const SUN_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv*2.0-1.0; gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0); }`;
export const SUN_FRAG = /* glsl */ `
${COMMON}
varying vec2 vUv;
void main(){
  float r = length(vUv);
  float a = atan(vUv.y, vUv.x);
  float core = exp(-r*r*14.0);
  float halo = exp(-r*3.2)*(0.35+0.4*uKick);
  float rays = pow(0.5+0.5*cos(a*24.0 + uTime*0.4), 6.0)*exp(-r*2.2)*(0.3+0.6*uSnare);
  vec3 col = vec3(1.0,0.95,0.85)*core*(0.5+uKick*0.8) + rainbow(uHue+r*0.8)*(halo+rays);
  gl_FragColor = vec4(col*smoothstep(1.0,0.7,r), 1.0);
}`;

export const PART_VERT = /* glsl */ `
${COMMON}
attribute vec4 aSeed;
uniform float uPx;
varying vec3 vC; varying float vA;
void main(){
  vec3 s = aSeed.xyz;
  float zz = mod(s.z*uLen - uTravel*1.15, uLen);
  float t = uTime*(0.3+0.5*aSeed.w);
  vec3 p = vec3((s.x-0.5)*180.0, 1.0 + s.y*70.0, 34.0 - zz);
  p.x += sin(t*1.3 + s.y*20.0)*5.0;
  p.y += sin(t*0.9 + s.x*30.0)*3.0 + uKick*3.0*aSeed.w;
  vec4 mv = viewMatrix*vec4(p,1.0);
  gl_Position = projectionMatrix*mv;
  float sz = (0.45 + 1.5*aSeed.w*aSeed.w) * (1.0 + 1.4*uHat*step(0.7, h11(aSeed.x*91.0)) + 0.6*uKick);
  gl_PointSize = clamp(sz*uPx*60.0/ -mv.z, 1.0, 36.0);
  vC = rainbow(aSeed.w + uHue + zz*0.002);
  vA = smoothstep(uLen, uLen*0.7, zz)*smoothstep(0.0, 18.0, zz);
}`;
export const PART_FRAG = /* glsl */ `
varying vec3 vC; varying float vA;
void main(){
  vec2 c = gl_PointCoord*2.0-1.0; float r = dot(c,c);
  if (r > 1.0) discard;
  float a = exp(-r*4.0)*(1.0-r)*vA;
  gl_FragColor = vec4(vC*a*1.3, a);
}`;

export const POST_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uKal, uFlash, uZoom, uRoll, uGrain;
varying vec2 vUv;
vec2 kal(vec2 uv, float n){
  vec2 p = uv-0.5; p.x *= uRes.x/uRes.y;
  float a = atan(p.y,p.x) + uTime*0.04, r = length(p);
  float seg = 6.2831853/n; a = abs(mod(a,seg)-seg*0.5);
  p = r*vec2(cos(a),sin(a)); p.x /= uRes.x/uRes.y; return p+0.5;
}
void main(){
  vec2 uv = vUv;
  // 中心に向かうズームパンチ(キック) + ロール
  vec2 c = uv-0.5;
  c *= 1.0 - uZoom;
  uv = c + 0.5;
  uv = mix(uv, kal(uv, 6.0), uKal);
  vec2 dir = uv-0.5; float rr = length(dir);
  float ab = 0.0015 + 0.011*uKick + 0.006*uSnare;
  vec3 col;
  col.r = texture2D(tDiffuse, uv + dir*ab*1.6).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - dir*ab*1.6).b;
  // 放射ブラー(キック)
  vec3 blur = vec3(0.0);
  for(int i=1;i<=4;i++){ blur += texture2D(tDiffuse, uv - dir*float(i)*0.012*(uKick+uSnare*0.5)).rgb; }
  col = mix(col, blur*0.25, clamp(0.45*(uKick+uSnare*0.5),0.0,0.5));
  col += uFlash*rainbow(uHue+rr)*0.35;
  // トーンマップ + 彩度
  col = 1.0 - exp(-col*0.95);
  float l = dot(col, vec3(0.299,0.587,0.114));
  col = mix(vec3(l), col, 1.25);
  col = pow(col, vec3(0.92));
  // ビネット + グレイン
  col *= smoothstep(1.05, 0.25, rr*1.25);
  col += (h21(uv*uRes + uTime) - 0.5)*uGrain;
  gl_FragColor = vec4(col, 1.0);
}`;
