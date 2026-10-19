import {COMMON, BLDG_VERT} from './glsl';

export const PLANT_VERT = /* glsl */ `
${COMMON}
${BLDG_VERT}
attribute vec3 aStart; attribute vec4 aMeta; attribute vec2 aUV; attribute vec4 aWall;
uniform float uPlant;
uniform vec4 uBand;      // LOD帯域: 近い端, 遠い端, 手前のフェード幅, 奥のフェード幅
varying vec3 vW; varying vec3 vN; varying vec4 vM; varying vec2 vUV; varying float vFade;
void main(){
  float zzq = mod(aInst.y - uTravel, uLen);
  if (zzq < uBand.x || zzq >= uBand.y) {           // この細かさの担当外 → 即座に画面外へ
    gl_Position = vec4(3.0, 3.0, 3.0, 1.0); vW = vec3(0.0); vN = vec3(0.0, 1.0, 0.0); vM = vec4(0.0); vUV = vec2(0.0); vFade = 0.0; return;
  }
  vFade = smoothstep(uBand.x, uBand.x + max(uBand.z, 0.001), zzq) * (1.0 - smoothstep(uBand.y - max(uBand.w, 0.001), uBand.y, zzq));
  Bd b = bldg();
  float rnd = h11(aInst2.x*17.3 + 1.7);
  float G = uPlant*(0.45 + 0.95*rnd) + 0.10*uKick*uPlant + 0.10*uVoxOn*uPlant;
  G *= smoothstep(uLen*0.78, uLen*0.34, b.zz);             // 近づくほど芽吹く
  float g = clamp((G - aMeta.x)/max(aMeta.y-aMeta.x, 0.001), 0.0, 1.0);
  g = g*g*(3.0-2.0*g);
  vec3 p = aStart + (position - aStart)*g;
  vec3 n = normal;
  float kind = aMeta.w;
  // 花は拍と声で脈動 / 葉は声とハイハットで震える
  if (kind > 1.5) { vec3 c0 = aStart; p = c0 + (p - c0)*(1.0 + 0.30*uKick + 0.10*uBeat + 0.25*uSnare + 0.35*uVoxOn); }
  else if (kind > 0.5) { p += n*sin(uTime*9.0 + position.x*3.0 + position.y*2.0 + aInst2.x*9.0)*0.04*(0.25 + uVoxOn*1.4 + uHat*0.8); }
  float mode = aWall.x;
  float s = (0.8 + 0.9*rnd) * (0.8 + 0.5*aInst.z/12.0) * (mode < 0.5 ? 1.2 : (mode < 1.5 ? 0.7 : (mode < 2.5 ? 0.95 : 0.9)));
  float ph = uTime*1.6 + aInst2.x*6.28 + p.y*0.45;
  p.x += sin(ph)*p.y*0.04*(1.0+uBass*1.2+uVox*0.8);
  p.z += cos(ph*0.8)*p.y*0.035*(1.0+uBass*1.2+uVox*0.8);
  float ang = aInst2.x*37.0; mat2 R = rot(ang);
  p.xz = R*p.xz; n.xz = R*n.xz;
  p *= s;
  float topSc = mix(1.0, 0.54, step(0.5, h11(aInst2.x*5.3)));   // 屋上は上の段の大きさ
  vec3 anchor;
  if (mode < 0.5) {            // 屋上
    vec2 off = vec2(h11(aInst2.x*5.1)-0.5, h11(aInst2.x*9.3)-0.5) * vec2(aInst.z, aInst2.y)*0.42*topSc;
    anchor = vec3(b.base.x + off.x, b.h, b.base.z + off.y);
  } else if (mode < 1.5) {     // 壁面から通りへ張り出す
    float sd = aWall.w;
    p = vec3(-sd*p.y, p.x, p.z); n = vec3(-sd*n.y, n.x, n.z);
    anchor = vec3(b.base.x - sd*aInst.z*0.5, b.h*aWall.y, b.base.z + aWall.z*aInst2.y);
  } else if (mode < 2.5) {     // 歩道の街路樹
    anchor = vec3(b.base.x, 0.0, b.base.z);
  } else {                     // 壁面を垂れる蔓
    float sd = aWall.w;
    anchor = vec3(b.base.x - sd*(aInst.z*0.5 + 0.35), b.h*aWall.y, b.base.z + aWall.z*aInst2.y);
  }
  vec3 w = anchor + p;
  vW = w; vN = n; vM = aMeta; vUV = aUV;
  gl_Position = projectionMatrix*viewMatrix*vec4(w,1.0);
}`;

export const PLANT_FRAG = /* glsl */ `
${COMMON}
varying vec3 vW; varying vec3 vN; varying vec4 vM; varying vec2 vUV; varying float vFade;
void main(){
  if (h21(gl_FragCoord.xy) > vFade) discard;       // LOD切り替えはディザでなめらかに
  vec3 N = normalize(vN); if(!gl_FrontFacing) N = -N;
  vec3 V = cameraPosition - vW; float dist = length(V); V/=dist;
  float kind = vM.w;
  float fres = 1.0-max(dot(N,V),0.0);
  float hue = vM.z + uHue + vW.y*0.0015 + fres*0.3 + vUV.y*0.08 + uPitch*0.12*uVox;
  vec3 base = rainbow(hue);
  vec3 L = normalize(vec3(0.35,0.85,0.4));
  float ndl = 0.5+0.5*dot(N, L);
  float rim = pow(fres, 2.2);
  vec3 col = base*(0.12 + 0.55*ndl);
  col += rainbow(hue+0.12)*pow(rim,3.0)*(0.3+0.2*uInten);
  if (kind > 0.5 && kind < 1.5) {          // 葉: 主脈・側脈・透過光
    float mid = smoothstep(0.07,0.0,abs(vUV.x-0.5)-0.012);
    float side = smoothstep(0.08,0.0,abs(fract(vUV.y*8.0 - abs(vUV.x-0.5)*5.0)-0.5)-0.42);
    float vein = mid + side*0.55;
    float back = pow(max(dot(-N, L), 0.0), 1.5);                    // 逆光で葉が透ける
    col += rainbow(hue+0.45)*vein*0.32*(0.5+uInten);
    col += rainbow(hue+0.15)*back*0.28;
    col *= 0.8 + 0.3*vUV.y;
    col = mix(vec3(dot(col,vec3(0.33))), col, 1.25);
    col += rainbow(hue+0.3)*uVoxOn*0.25*mid;
  } else if (kind > 1.5) {                 // 花弁: 根元は温かく先端は虹、縁に光の粒と細い筋
    float tip = vUV.y;
    float streak = 0.5+0.5*sin(vUV.x*40.0 + tip*3.0);
    col = rainbow(hue + tip*0.35)*(0.22+0.78*ndl)*(0.85+0.15*streak) + rainbow(hue+tip*0.35+0.12)*rim*0.35;
    col += vec3(1.0,0.5,0.2)*pow(1.0-tip,5.0)*0.18;
    float dots = smoothstep(0.13,0.0,length(vec2(vUV.x-0.5, fract(tip*5.0)-0.5)*vec2(1.6,0.9)));
    col += rainbow(hue+0.2)*dots*0.2;
    col += rainbow(hue+0.5)*smoothstep(0.85,1.0,abs(vUV.x-0.5)*2.0)*0.25;
    col *= 1.0 + 0.45*uKick + 0.2*uBeat + 0.5*uVoxOn;
  } else {                                 // 幹・枝: 樹皮の縦筋と流れる光
    float groove = pow(abs(sin(vUV.x*34.0 + sin(vUV.y*9.0)*1.6)), 0.6);
    col = base*(0.10 + 0.48*ndl)*(0.55 + 0.6*groove);
    col += rainbow(hue+0.12)*pow(rim,3.0)*0.3;
    float flow = 0.5+0.5*sin(vUV.y*30.0 - uTime*6.0 + vM.z*20.0);
    col += rainbow(hue+0.2)*flow*0.07*(0.3+uInten) + rainbow(hue+0.35)*uVoxOn*0.1*flow;
  }
  float fg = 1.0-exp(-dist*0.0046);
  vec3 fogC = rainbow(uHue+0.55+dist*0.0006)*(0.08+0.10*uInten) + vec3(0.015,0.0,0.055);
  col = mix(col, fogC, fg);
  gl_FragColor = vec4(min(col, vec3(1.9)), 1.0);
}`;

export const LAMP_VERT = /* glsl */ `
${COMMON}
attribute vec4 aLamp;    // 左右, z0, 高さ倍率, id
attribute float aPart;   // 0=支柱 1=灯
varying vec3 vN; varying float vPart; varying vec3 vW; varying float vId;
void main(){
  float zz = mod(aLamp.y - uTravel, uLen);
  float rise = smoothstep(uLen, uLen*0.6, zz);
  vec3 p = position; p.x *= aLamp.x; vec3 n = normal; n.x *= aLamp.x;
  p.y *= aLamp.z*rise;
  vec3 w = vec3(roadX(zz) + aLamp.x*15.7 + p.x, p.y, 34.0 - zz + p.z);
  if (aPart > 0.5) w.y += (uKick*0.5 + uVoxOn*0.4)*0.3;
  vN = n; vPart = aPart; vW = w; vId = aLamp.w;
  gl_Position = projectionMatrix*viewMatrix*vec4(w,1.0);
}`;
export const LAMP_FRAG = /* glsl */ `
${COMMON}
varying vec3 vN; varying float vPart; varying vec3 vW; varying float vId;
void main(){
  vec3 V = cameraPosition - vW; float dist = length(V); V/=dist;
  vec3 N = normalize(vN);
  float rim = pow(1.0-max(dot(N,V),0.0), 2.0);
  vec3 col;
  if (vPart > 0.5) col = rainbow(uHue + vId*0.5)*(1.1 + 0.9*uBeat + 1.2*uKick + 1.0*uVoxOn);
  else col = vec3(0.05,0.04,0.12) + rainbow(uHue+vId)*rim*0.35 + rainbow(uHue+0.3)*0.05*(0.5+0.5*N.y);
  float fg = 1.0-exp(-dist*0.0046);
  vec3 fogC = rainbow(uHue+0.55+dist*0.0006)*(0.08+0.10*uInten) + vec3(0.015,0.0,0.055);
  gl_FragColor = vec4(min(mix(col, fogC, fg), vec3(2.2)), 1.0);
}`;

/** 道に沿って流れる旋律線: 声のピッチが高さ、声の強さが太さ/明るさ */
export const RIBBON_VERT = /* glsl */ `
${COMMON}
uniform sampler2D uMelody; uniform float uMelodyW;
varying float vV; varying float vU; varying float vZ; varying float vP;
void main(){
  float s = uv.y;                        // 0=手前 1=奥
  float zz = 8.0 + s*(uLen*0.8);
  float wz = max(uTravel + zz - 40.0, 0.0);   // 走行距離の座標 = 音源上の時刻。今歌っている音がカメラの少し前に来る
  vec2 m = texture2D(uMelody, vec2((wz*0.5 + 0.5)/uMelodyW, 0.5)).rg;
  float vox = m.g;
  float y = 5.0 + m.r*13.0 + sin(wz*0.05)*0.6;
  float width = (0.12 + 0.9*vox)*(0.6+0.4*smoothstep(0.0,25.0,zz));
  float x = roadX(zz) + sin(wz*0.045)*3.2 + (uv.x - 0.5)*2.0*width;
  vV = vox; vU = uv.x; vZ = zz; vP = m.r;
  gl_Position = projectionMatrix*viewMatrix*vec4(x, y + (uv.x-0.5)*0.15, 34.0 - zz, 1.0);
}`;
export const RIBBON_FRAG = /* glsl */ `
${COMMON}
varying float vV; varying float vU; varying float vZ; varying float vP;
void main(){
  float core = exp(-pow((vU-0.5)*3.2, 2.0));
  float a = smoothstep(0.12, 0.45, vV)*smoothstep(8.0, 30.0, vZ)*smoothstep(uLen*0.8, uLen*0.4, vZ);
  vec3 c = rainbow(uHue + vP*0.7 + vZ*0.004)*(0.8 + 1.4*core)*(0.6 + 0.8*uVoxOn + 0.3*uBeat);
  gl_FragColor = vec4(c*a*core, a*core);
}`;

/** 巨大曼荼羅花 (フィボナッチ花弁) */
export const HERO_VERT = /* glsl */ `
${COMMON}
attribute float aN;       // 花弁の番号
uniform float uBloom, uSpin, uTotal, uHueOff;
varying vec3 vNn; varying vec2 vUV; varying float vF; varying vec3 vWp;
void main(){
  float f = (aN+0.5)/uTotal;
  float base = aN*2.399963;
  float warp = 0.30*uBass + 0.25*uMid + 0.25*uKick + 0.3*uVoxOn;
  float ang = base + uSpin + f*uMid*1.6;                       // 中域でねじれる
  float sector = fract(base/6.283185);
  float spv = specAt(floor(sector*16.0));                       // 角度ごとにスペクトラム = 放射状イコライザー
  float R = 100.0;
  float rad = sqrt(f)*R*0.62*(1.0 + warp*0.45*sin(ang*3.0 + uTime*0.9));   // 低音でぐにゃりと歪む
  vec2 rd = vec2(cos(ang), sin(ang));
  float open = smoothstep(f*0.4, f*0.4+0.3, uBloom*1.1);
  float el = mix(1.38, 0.10 + 0.45*(1.0-f), open) + (spv-0.3)*0.7*(0.4+uInten) + 0.3*uKick*(1.0-f) + 0.2*uVox*sin(sector*12.566 + uPitch*8.0 + uTime*1.2);
  vec3 radial = vec3(rd, 0.0);
  vec3 fwd = normalize(radial*cos(el) + vec3(0.0,0.0,sin(el)));
  vec3 side = vec3(-rd.y, rd.x, 0.0);
  float len = R*(0.12 + 0.66*pow(f,0.6))*(0.30+0.70*open)*(1.0 + 0.65*spv);
  float wid = len*0.30;
  float v = uv.y; float u = uv.x*2.0-1.0;
  float prof = pow(sin(3.14159*min(1.0,0.10+v*0.9)), 0.75);
  vec3 pos = vec3(rad*rd, 0.0) + fwd*(v*len);
  pos.z -= 0.35*len*v*v*(1.0-0.5*open);
  pos += side*(u*wid*prof);
  pos.z += u*u*wid*0.35*prof*v + sin(ang*5.0 - uTime*1.6)*warp*len*0.35*v;
  pos.xy += rd*sin(ang*2.0 + uTime*0.6)*warp*len*0.25*v;
  vec3 nn = normalize(cross(side, fwd));
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
  float hue = vF*0.9 + vUV.y*0.22 + uHue + uHueOff + uPitch*0.25*uVox;
  vec3 base = rainbow(hue);
  float shade = 0.5+0.5*dot(N,normalize(vec3(0.3,0.5,0.8)));
  vec3 col = base*(0.22 + 0.55*shade);
  float mid = exp(-pow(vUV.x*3.0,2.0))*(1.0-vUV.y);                 // 花弁の中心線
  col += rainbow(hue+0.15)*mid*0.4;
  col += rainbow(hue+0.3)*rim*0.35;
  float edge = smoothstep(0.7,1.0,abs(vUV.x));
  col += rainbow(hue+0.55)*edge*(0.35+0.4*vF)*(0.5+uInten);
  col *= 0.9 + 0.55*vF;
  col *= 0.95 + 0.3*uBeat + 0.45*uKick;
  gl_FragColor = vec4(min(col, vec3(1.8)), 1.0);
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
  vec3 p = vec3((s.x-0.5)*180.0 + roadX(zz), 1.0 + s.y*70.0, 34.0 - zz);
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
  float ab = 0.0012 + 0.004*uKick + 0.002*uSnare;
  vec3 col;
  col.r = texture2D(tDiffuse, uv + dir*ab*1.6).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - dir*ab*1.6).b;
  // 放射ブラー(キック)
  vec3 blur = vec3(0.0);
  for(int i=1;i<=4;i++){ blur += texture2D(tDiffuse, uv - dir*float(i)*0.006*(uKick+uSnare*0.5)).rgb; }
  col = mix(col, blur*0.25, clamp(0.2*(uKick+uSnare*0.5),0.0,0.25));
  col += uFlash*rainbow(uHue+rr)*0.35;
  // トーンマップ + 彩度
  col = 1.0 - exp(-col*1.25);
  float l = dot(col, vec3(0.299,0.587,0.114));
  col = mix(vec3(l), col, 1.35);
  // 青みのカラーグレード: 影は青く、緑の出すぎを抑え、ハイライトは素直に
  float sh = 1.0 - smoothstep(0.0, 0.6, l);
  col = col*vec3(0.95, 0.88, 1.08) + vec3(0.0, 0.012, 0.07)*sh;
  col = pow(col, vec3(0.92));
  // ビネット + グレイン
  col *= smoothstep(1.25, 0.32, rr*1.2);
  col += (h21(uv*uRes + uTime) - 0.5)*uGrain;
  gl_FragColor = vec4(col, 1.0);
}`;
