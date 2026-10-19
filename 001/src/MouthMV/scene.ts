import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import * as A from './audio';
import {BUILDING_VERT, BUILDING_FRAG, GROUND_VERT, GROUND_FRAG, SKY_VERT, SKY_FRAG} from './glsl';
import {PLANT_VERT, PLANT_FRAG, HERO_VERT, HERO_FRAG, SUN_VERT, SUN_FRAG, PART_VERT, PART_FRAG, POST_FRAG} from './glsl2';
import {buildSpecies, mulberry} from './plants';

const HERO_POS = new THREE.Vector3(0, 215, -560);

/** Catmull-Romで滑らかに補間するキーフレーム */
const curve = (keys: [number, number][], t: number) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (t <= keys[i + 1][0]) {
      const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
      const p0 = keys[Math.max(0, i - 1)][1], p3 = keys[Math.min(keys.length - 1, i + 2)][1];
      const u = (t - t0) / (t1 - t0);
      const m1 = (v1 - p0) * 0.5, m2 = (p3 - v0) * 0.5;
      const u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * m2;
    }
  }
  return keys[keys.length - 1][1];
};
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 曲の展開に合わせたカメラ高度 (秒, y)
const CAM_Y: [number, number][] = [[0, 4], [20, 5], [48, 7], [72, 10], [96, 7], [100, 4.5], [130, 9], [144, 5]];
const L = A.LEN;
const roadR = (w: number) => 34 * Math.sin(6.2832 * w / L) + 12 * Math.sin(12.5664 * w / L + 1.3);
const cumKick = (() => { const o = new Float32Array(A.FRAMES + 2); let s = 0; for (let f = 0; f < o.length; f++) { s += A.kick[f]; o[f] = s; } return o; })();

export class MVScene {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  camera: THREE.PerspectiveCamera;
  scene = new THREE.Scene();
  U: Record<string, {value: any}>;
  post: ShaderPass;
  bloom: UnrealBloomPass;
  heroes: {mat: THREE.ShaderMaterial; mesh: THREE.Mesh; spin: number; hueOff: number}[] = [];
  sky: THREE.ShaderMaterial;
  ground: THREE.ShaderMaterial;
  sun: THREE.Mesh;
  heroGroup = new THREE.Group();
  spec: number[] = new Array(16).fill(0);
  W: number; H: number; timing = false;

  constructor(canvas: HTMLCanvasElement, W: number, H: number, hide = '') {
    this.W = W; this.H = H;
    const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    this.renderer = renderer;
    this.camera = new THREE.PerspectiveCamera(60, W / H, 0.5, 1800);
    this.U = {
      uTime: {value: 0}, uTravel: {value: 0}, uLen: {value: A.LEN}, uKick: {value: 0}, uSnare: {value: 0}, uHat: {value: 0},
      uBass: {value: 0}, uMid: {value: 0}, uInten: {value: 0}, uHue: {value: 0}, uBeat: {value: 0}, uKickAge: {value: 99},
      uBeatPos: {value: 0}, uKickIdx: {value: 0}, uBend: {value: 0}, uSpec: {value: this.spec}, uPlant: {value: 0},
    };
    const U = this.U;
    const mk = (vs: string, fs: string, extra: any = {}, params: THREE.ShaderMaterialParameters = {}) =>
      new THREE.ShaderMaterial({vertexShader: vs, fragmentShader: fs, uniforms: {...U, ...extra}, ...params});

    // ---- 空 (フラクタル万華鏡) ----
    this.sky = mk(SKY_VERT, SKY_FRAG, {uHeroDir: {value: new THREE.Vector3()}, uKal: {value: 0}}, {side: THREE.BackSide, depthWrite: false, depthTest: false});
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 28), this.sky);
    sky.renderOrder = -10; sky.frustumCulled = false;
    this.scene.add(sky);

    // ---- 地面 ----
    this.ground = mk(GROUND_VERT, GROUND_FRAG, {uCamPos: {value: new THREE.Vector3()}});
    const gp = new THREE.PlaneGeometry(1400, 1400, 1, 1); gp.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(gp, this.ground); ground.frustumCulled = false;
    this.scene.add(ground);

    // ---- ビル群 + 屋上の植物 ----
    const R = mulberry(20260101);
    const SLOTS = 16, LANES = 5, pitch = A.LEN / SLOTS;
    type Inst = {a: number[]; b: number[]; sp: number; w: number[]};
    const insts: Inst[] = [];
    const HMAX = [[12, 14], [20, 20], [30, 28], [40, 34], [50, 42]];
    const STREET = 24;
    for (const side of [-1, 1]) for (let l = 0; l < LANES; l++) for (let s = 0; s < SLOTS; s++) {
      const w = 11 + R() * 6, d = 12 + R() * 5;
      const x = side * (STREET + l * 21 + w * 0.5 + (R() - 0.5) * 2);
      const tall = R() < 0.12 ? 1.6 : 1;
      const hmax = (HMAX[l][0] + R() * HMAX[l][1]) * tall;
      const band = Math.min(15, Math.floor(l * 3 + R() * 3));
      insts.push({a: [x, s * pitch + (R() - 0.5) * 2, w, hmax], b: [R(), d, band, l], sp: Math.floor(R() * 4), w: [0, 0, 0, side]});
    }
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    const makeInstanced = (base: THREE.BufferGeometry, items: Inst[]) => {
      const g = new THREE.InstancedBufferGeometry();
      g.index = base.index;
      for (const k of Object.keys(base.attributes)) g.setAttribute(k, base.attributes[k]);
      g.setAttribute('aInst', new THREE.InstancedBufferAttribute(new Float32Array(items.flatMap((i) => i.a)), 4));
      g.setAttribute('aInst2', new THREE.InstancedBufferAttribute(new Float32Array(items.flatMap((i) => i.b)), 4));
      g.setAttribute('aWall', new THREE.InstancedBufferAttribute(new Float32Array(items.flatMap((i) => i.w)), 4));
      g.instanceCount = items.length;
      return g;
    };
    // 植物の配置: 屋上 / 壁面から張り出し / 歩道の街路樹
    const plants: Inst[] = [];
    for (const b of insts) {
      if (R() < 0.55) plants.push({...b, sp: Math.floor(R() * 4), w: [0, 0, 0, b.w[3]]});
      if (b.b[3] <= 1 && R() < (b.b[3] === 0 ? 0.75 : 0.45)) {
        for (let k = 0; k < 1; k++) plants.push({a: b.a, b: [R(), b.b[1], b.b[2], b.b[3]], sp: Math.floor(R() * 4), w: [1, 0.12 + R() * 0.6, (R() - 0.5) * 0.8, b.w[3]]});
      }
    }
    for (const side of [-1, 1]) for (let s = 0; s < SLOTS; s++) {
      plants.push({a: [side * (STREET - 4 + (R() - 0.5) * 2), s * pitch + 4 + R() * 4, 6, 0], b: [R(), 6, 0, 0], sp: Math.floor(R() * 4), w: [2, 0, 0, side]});
    }
    const bm = mk(BUILDING_VERT, BUILDING_FRAG);
    const bmesh = new THREE.Mesh(makeInstanced(box, insts), bm); bmesh.frustumCulled = false;
    this.scene.add(bmesh);
    const pm = mk(PLANT_VERT, PLANT_FRAG, {}, {side: THREE.DoubleSide});
    for (let k = 0; k < 4; k++) {
      const items = plants.filter((i) => i.sp === k);
      const pg = makeInstanced(buildSpecies(k, 77 + k * 31), items);
      const m = new THREE.Mesh(pg, pm); m.frustumCulled = false;
      this.scene.add(m);
    }

    // ---- 巨大曼荼羅花 ----
    const makePetals = (total: number, spinSign: number, hueOff: number) => {
      const base = new THREE.PlaneGeometry(1, 1, 4, 8);
      const g = new THREE.InstancedBufferGeometry();
      g.index = base.index;
      g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv); g.setAttribute('normal', base.attributes.normal);
      g.setAttribute('aN', new THREE.InstancedBufferAttribute(Float32Array.from({length: total}, (_, i) => i), 1));
      g.instanceCount = total;
      const mat = mk(HERO_VERT, HERO_FRAG, {uBloom: {value: 0}, uSpin: {value: 0}, uTotal: {value: total}, uHueOff: {value: hueOff}}, {side: THREE.DoubleSide});
      const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false;
      this.heroGroup.add(mesh);
      this.heroes.push({mat, mesh, spin: spinSign, hueOff});
      return mesh;
    };
    const m1 = makePetals(233, 1, 0);
    const m2 = makePetals(89, -1, 0.5); m2.scale.setScalar(0.5); m2.position.z = 14;
    const m3 = makePetals(34, 1, 0.25); m3.scale.setScalar(0.22); m3.position.z = 26;
    this.heroGroup.position.copy(HERO_POS);
    this.heroGroup.scale.setScalar(3.6);
    this.scene.add(this.heroGroup);
    const sunMat = mk(SUN_VERT, SUN_FRAG, {}, {transparent: true, blending: THREE.AdditiveBlending, depthWrite: false});
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sunMat); this.sun.frustumCulled = false;
    this.sun.position.z = 34; this.sun.scale.setScalar(45);
    this.heroGroup.add(this.sun);

    // ---- 花粉 / 胞子 ----
    const NP = 6500;
    const seeds = new Float32Array(NP * 4); const rp = mulberry(5);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rp();
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(NP * 3), 3));
    pg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    const pmat = mk(PART_VERT, PART_FRAG, {uPx: {value: H / 720}}, {transparent: true, blending: THREE.AdditiveBlending, depthWrite: false});
    const pts = new THREE.Points(pg, pmat); pts.frustumCulled = false;
    this.scene.add(pts);

    // ---- ポスト ----
    const rt = new THREE.WebGLRenderTarget(W, H, {type: THREE.HalfFloatType, samples: 2});
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.7, 0.7, 0.5);
    this.composer.addPass(this.bloom);
    this.post = new ShaderPass({
      uniforms: {...U, tDiffuse: {value: null}, uRes: {value: new THREE.Vector2(W, H)}, uKal: {value: 0}, uFlash: {value: 0}, uZoom: {value: 0}, uRoll: {value: 0}, uGrain: {value: 0.025}},
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: POST_FRAG,
    });
    this.composer.addPass(this.post);
    this.composer.setSize(W, H);
    const hs = new Set(hide.split(',').filter(Boolean));
    this.timing = hs.has('time');
    sky.visible = !hs.has('sky'); ground.visible = !hs.has('ground'); bmesh.visible = !hs.has('bld'); pts.visible = !hs.has('pts');
    this.sun.visible = !hs.has('sun'); this.heroGroup.visible = !hs.has('hero');
    this.scene.children.forEach((c) => { if ((c as any).geometry?.attributes?.aStart) c.visible = !hs.has('plants'); });
    this.bloom.enabled = !hs.has('bloom');
  }

  frame(f: number) {
    const U = this.U; const t = f / A.FPS;
    const kick = A.kick[f], snare = A.snare[f], hat = A.hat[f], bass = A.bass[f], inten = A.inten[f];
    const bp = A.beatPos(f); const bf = ((bp % 1) + 1) % 1;
    const bar = Math.floor(bp / 4);
    const hueP = bp / 16;
    const hue = 0.34 + 0.07 * Math.sin(t * 0.045) + 0.09 * Math.sin(hueP * 1.7) * (0.5 + 0.5 * inten); // 青を中心に揺れる基調色
    U.uTime.value = t; U.uTravel.value = A.travel[f]; U.uKick.value = kick; U.uSnare.value = snare; U.uHat.value = hat;
    U.uBass.value = bass; U.uMid.value = A.mid[f]; U.uInten.value = inten; U.uHue.value = hue;
    U.uBeat.value = Math.exp(-bf * 4); U.uKickAge.value = A.kickAge[f]; U.uBeatPos.value = bp;
    A.specAt(f, this.spec);
    // 植物は序盤は芽 → 中盤で茂り → サビで満開、ブレイクで一旦しぼむ
    U.uPlant.value = Math.min(1.25, 0.28 + sstep(2, 40, t) * 0.55 + inten * 0.5 + sstep(70, 80, t) * 0.15);

    // カメラ
    const cy = curve(CAM_Y, t) + kick * 0.6;
    const low = 1 - sstep(10, 22, cy);
    const cx = (Math.sin(t * 0.21) * 4 + Math.sin(t * 0.07 + 1) * 3) * (0.5 + 0.5 * low + 0.6 * (1 - low)) + Math.sin(t * 0.9) * 0.4 * bass;
    // 曲がりくねる道に沿って進む: 視線は先のカーブを向き、体をバンクさせる
    U.uKickIdx.value = A.kickIdx[f];
    const road = (zz: number) => roadR(zz + A.travel[f]) - roadR(34 + A.travel[f]);
    const lookYaw = Math.atan2(road(150) * 0.75, 150);
    const pos = new THREE.Vector3(Math.sin(t * 0.21) * 1.5, cy, 0);
    const pitch = 0.28;
    const roll = -0.4 * lookYaw + 0.02 * Math.sin(t * 0.4);
    const cutPulse = 0;
    this.camera.position.copy(pos);
    const dir = new THREE.Vector3(Math.sin(lookYaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(lookYaw) * Math.cos(pitch));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(pos.clone().addScaledVector(dir, 300));
    const rollDir = A.snareIdx[f] % 2 ? 1 : -1;
    this.camera.rotateZ(roll + rollDir * 0.027 * snare * (0.4 + inten));
    const fovAdd = 0;
    this.camera.fov = 58 + fovAdd + 8.7 * kick * (0.5 + inten) + 3.3 * snare;
    this.camera.updateProjectionMatrix();

    // 巨大花
    const bloom = Math.min(1.2, 0.55 + inten * 0.55 + 0.1 * kick);
    const spinBase = t * 0.07 + cumKick[f] * 0.012;
    this.heroes.forEach((h, i) => {
      h.mat.uniforms.uBloom.value = Math.min(1.2, bloom * (1 + i * 0.05));
      h.mat.uniforms.uSpin.value = spinBase * h.spin * (1 + i * 0.6);
    });
    this.heroGroup.rotation.z = Math.sin(t * 0.05) * 0.12;
    this.heroGroup.scale.setScalar(3.6 * (1 + 0.05 * kick));
    const hd = new THREE.Vector3().subVectors(HERO_POS, pos).normalize();
    this.sky.uniforms.uHeroDir.value.copy(hd);
    this.sky.uniforms.uKal.value = Math.floor(bar / 4) % 4;
    this.ground.uniforms.uCamPos.value.set(pos.x, 0, 0);

    // ポスト
    const kalOn = sstep(0.5, 0.62, inten) * ((bar % 4 === 3) ? 1 : 0) * sstep(0, 0.12, bf + (bar % 4 === 3 ? 0.12 : 0));
    const dropHit = t >= 72 && t < 72.4 ? 0.6 * (1 - (t - 72) / 0.4) : t >= 100 && t < 100.35 ? 0.6 * (1 - (t - 100) / 0.35) : 0;
    const P = this.post.uniforms;
    P.uKal.value = kalOn; P.uFlash.value = Math.max(0.2 * snare * inten, dropHit, 0.3 * cutPulse);
    P.uZoom.value = 0.033 * kick * (0.35 + inten) + 0.013 * snare + 0.07 * cutPulse;
    this.bloom.strength = 0.36 + 0.3 * kick + 0.18 * inten;
    this.bloom.threshold = 0.8; this.bloom.radius = 0.75;
    const t0 = performance.now();
    this.composer.render();
    if (this.timing) { const gl = this.renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); }
    if (this.timing) console.log('FRAMEMS', f, Math.round(performance.now() - t0));
  }

  dispose() { this.composer.dispose(); this.renderer.dispose(); }
}
