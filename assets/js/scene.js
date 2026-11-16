// The stage: Aryan's cartoon character standing in a soft gradient world.
//
// The character is a set of rendered stills (assets/character/pose-N.webp), not a 3D model,
// so it lives on a gently curved card inside a real 3D scene. That is enough to make it feel
// alive: the camera pushes in and swings around it as you scroll, whatever the shot is aimed
// at stays sharp while the rest falls out of focus, it changes pose from section to section,
// its eyes and head follow the cursor, and it leans and breathes.
//
// Scrolling drives everything: hero shot → one shot per résumé entry → a full-body shot
// behind the works gallery. That one-stop-per-entry idea follows sen-3d-resume (MIT) —
// see THIRD_PARTY_LICENSES.md.

import * as THREE from 'three';

/* ───────── Tunables ───────── */

const BACKGROUND = { top: '#6f906f', bottom: '#dbd3b5', steep: 1.4 };

// The card the character is drawn on: 4 × 6 world units (the stills are 2:3).
const CARD = { w: 4, h: 6, curve: 0.07 };

// Per-pose data, in image pixels: where the irises are (for the eye-follow) and where the
// neck is (everything above it leans towards the cursor).
const POSES = {
  1: { size: [1024, 1536], eyes: [[459, 177], [534, 164]], eyeR: [16, 9], neck: 292 },  // heart hands
  2: { size: [1024, 1536], eyes: [[471, 183], [549, 174]], eyeR: [16, 9], neck: 300 },  // hands in pockets
  3: { size: [1024, 1536], eyes: [[462, 181], [541, 171]], eyeR: [16, 9], neck: 296 },  // peace sign
  4: { size: [1024, 1536], eyes: [[474, 176], [550, 167]], eyeR: [16, 9], neck: 290 },  // waving
  5: { size: [1040, 1512], eyes: [[471, 224], [570, 219]], eyeR: [20, 11], neck: 395 }, // sitting
};

// Camera shots. `at` is the point on the card the camera aims at, in image pixels of that
// pose; `dist` is the camera distance; `az`/`el` orbit it in degrees; `shift` slides the
// subject left by that fraction of the screen to leave room for the text column.
// `blur` is how strongly everything away from that point falls out of focus.
const HERO_SHOT = { pose: 4, at: [505, 400], dist: 4.6, az: 0, el: 0, shift: 0, blur: 0.2 };
const NODE_SHOTS = [
  { pose: 2, at: [508, 190], dist: 2.2, az: -24, el: 7, shift: 0.23, blur: 1 },    // education: glasses
  { pose: 5, at: [520, 255], dist: 2.4, az: 18, el: 6, shift: 0.23, blur: 1 },     // internship: face
  { pose: 3, at: [395, 215], dist: 2.5, az: -22, el: 9, shift: 0.23, blur: 1 },    // Fetch.ai: peace sign
  { pose: 1, at: [508, 425], dist: 2.3, az: 20, el: -9, shift: 0.23, blur: 1 },    // CXI-MIET: heart hands
  { pose: 4, at: [330, 250], dist: 2.9, az: -14, el: -9, shift: 0.2, blur: 0.9 },  // creator: wave
];
const WORKS_SHOT = { pose: 2, at: [512, 330], dist: 3.7, az: -12, el: 2, shift: 0.34, blur: 0.25 };

const CAM = {
  fov: 39,
  damping: 3.4,      // higher = snappier camera
  dwell: 0.35,       // share of each scroll segment the camera rests on its stop
  nodeLine: 0.3,     // an entry "locks" when its top reaches this fraction of the viewport
  parallax: 0.2,     // camera drift with the cursor
  mobilePullback: 1.3,
  mobileLift: 0.1,
};

const LIFE = {
  tilt: 0.1,        // how far the card turns towards the cursor (radians)
  headLean: 0.06,    // how far the head leans towards the cursor (world units)
  bodyLean: 0.035,   // how far the whole body sways
  gaze: 6.2,         // how far the irises travel (image pixels)
  breathe: 0.006,
};

/* ───────── Helpers ───────── */

const { damp, clamp, lerp, degToRad, smoothstep } = THREE.MathUtils;
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

// Image pixel of a pose → point on the card (world units; the card is centred on the origin).
function cardPoint(pose, [px, py], out) {
  const [w, h] = POSES[pose].size;
  return out.set((px / w - 0.5) * CARD.w, (0.5 - py / h) * CARD.h, 0);
}

// Pose data as shader uniforms (eye centres, eye radii and neck height in UV space).
function poseUniforms(pose) {
  const p = POSES[pose];
  const [w, h] = p.size;
  return {
    eyes: new THREE.Vector4(p.eyes[0][0] / w, 1 - p.eyes[0][1] / h, p.eyes[1][0] / w, 1 - p.eyes[1][1] / h),
    eyeR: new THREE.Vector2(p.eyeR[0] / w, p.eyeR[1] / h),
    px: new THREE.Vector2(1 / w, 1 / h),
    neck: 1 - p.neck / h,
  };
}

/* ───────── Backdrop: vertical gradient on the inside of a big sphere ───────── */

function buildBackdrop() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTop: { value: new THREE.Color(BACKGROUND.top) },
        uBottom: { value: new THREE.Color(BACKGROUND.bottom) },
        uSteep: { value: BACKGROUND.steep },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        uniform float uSteep;
        varying vec3 vDir;
        void main() {
          float t = clamp(vDir.y * uSteep * 0.5 + 0.5, 0.0, 1.0);
          gl_FragColor = vec4(mix(uBottom, uTop, t), 1.0);
          #include <colorspace_fragment>
        }`,
    })
  );
  mesh.renderOrder = 0;
  return mesh;
}

/* ───────── The character card ───────── */

function buildCharacter() {
  const uniforms = {
    uTexA: { value: null }, uTexB: { value: null },
    uMix: { value: 0 },
    uEyesA: { value: new THREE.Vector4() }, uEyesB: { value: new THREE.Vector4() },
    uEyeRA: { value: new THREE.Vector2() }, uEyeRB: { value: new THREE.Vector2() },
    uPxA: { value: new THREE.Vector2() }, uPxB: { value: new THREE.Vector2() },
    uNeck: { value: 0.8 },
    uGaze: { value: new THREE.Vector2() },
    uHead: { value: new THREE.Vector2() },
    uLean: { value: 0 },
    uBreath: { value: 0 },
    uCurve: { value: CARD.curve },
    uGazeAmp: { value: LIFE.gaze },
    uFocus: { value: new THREE.Vector2(0.5, 0.8) },
    uBlur: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      uniform float uNeck, uLean, uBreath, uCurve;
      uniform vec2 uHead;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;

        // Whole body sways from the feet; the head leans further, from the neck up.
        p.x += uv.y * uv.y * uLean;
        float head = smoothstep(uNeck - 0.035, uNeck + 0.05, uv.y);
        p.xy += head * uHead;

        // Breathing: the chest widens and the shoulders rise a touch.
        float chest = smoothstep(0.42, 0.62, uv.y) * (1.0 - smoothstep(uNeck - 0.02, uNeck + 0.04, uv.y));
        p.x *= 1.0 + chest * uBreath;
        p.y += smoothstep(0.45, 0.8, uv.y) * uBreath * 1.6;

        // The card is slightly bowed, so turning it reveals a little depth.
        p.z -= p.x * p.x * uCurve;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uTexA, uTexB;
      uniform float uMix, uGazeAmp, uBlur;
      uniform vec4 uEyesA, uEyesB;
      uniform vec2 uEyeRA, uEyeRB, uPxA, uPxB, uGaze, uFocus;
      varying vec2 vUv;

      // Eye-follow: the iris and pupil slide towards the gaze direction. The pull is strongest
      // at the centre of each eye and fades to nothing at the lids, so the lids never move.
      vec2 look(vec2 uv, vec4 eyes, vec2 r, vec2 px) {
        vec2 da = (uv - eyes.xy) / r, db = (uv - eyes.zw) / r;
        float a = max(0.0, 1.0 - dot(da, da)), b = max(0.0, 1.0 - dot(db, db));
        float pull = max(a * a, b * b);
        return uv + pull * uGaze * vec2(uGazeAmp, uGazeAmp * 0.42) * px;
      }

      // Depth of field: a 12-tap disc blur whose radius grows with distance from the focus point.
      vec4 soft(sampler2D tex, vec2 uv, float radius, float spin) {
        vec4 c = texture2D(tex, uv);
        if (radius < 0.0004) return c;
        vec4 acc = vec4(c.rgb * c.a, c.a);
        for (int i = 1; i <= 12; i++) {
          float f = float(i);
          float ang = f * 2.39996 + spin;
          vec2 o = vec2(cos(ang), sin(ang) * 0.667) * radius * sqrt(f / 12.0);
          vec4 t = texture2D(tex, uv + o);
          acc += vec4(t.rgb * t.a, t.a);
        }
        acc /= 13.0;
        return vec4(acc.a > 0.001 ? acc.rgb / acc.a : vec3(0.0), acc.a);
      }

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      void main() {
        vec2 d = (vUv - uFocus) * vec2(1.0, 1.5);
        float radius = uBlur * smoothstep(0.07, 0.42, length(d)) * 0.011;
        float spin = hash(gl_FragCoord.xy) * 6.2831;

        vec4 a = soft(uTexA, look(vUv, uEyesA, uEyeRA, uPxA), radius, spin);
        vec4 b = uMix > 0.0 ? soft(uTexB, look(vUv, uEyesB, uEyeRB, uPxB), radius, spin) : a;

        // Pose change: a grainy wipe that travels from the head down to the feet.
        float edge = (1.0 - vUv.y) + (hash(floor(vUv * vec2(160.0, 240.0))) - 0.5) * 0.09;
        float m = smoothstep(0.0, 0.1, uMix * 1.25 - edge - 0.06);
        vec4 c = mix(a, b, m);

        // A warm glint rides the wipe line.
        float line = smoothstep(0.05, 0.0, abs(uMix * 1.25 - edge - 0.11)) * step(0.001, uMix) * step(uMix, 0.999);
        c.rgb += vec3(1.0, 0.85, 0.7) * line * 0.5 * c.a;

        gl_FragColor = c;
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CARD.w, CARD.h, 40, 120), material);
  mesh.renderOrder = 2;
  const group = new THREE.Group();
  group.add(mesh);
  return { group, mesh, uniforms };
}

/* ───────── Init ───────── */

export async function initScene(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor('#0a0e16');

  const scene = new THREE.Scene();
  const backdrop = buildBackdrop();
  backdrop.scale.setScalar(60);
  scene.add(backdrop);

  const character = buildCharacter();
  scene.add(character.group);
  const U = character.uniforms;

  const camera = new THREE.PerspectiveCamera(CAM.fov, 1, 0.1, 200);

  /* ── Textures: the hero pose blocks the loader, the rest stream in behind it ── */
  const loader = new THREE.TextureLoader();
  const textures = {};
  const poseData = {};
  const loadPose = (n) =>
    loader.loadAsync(`assets/character/pose-${n}.webp`).then((tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      textures[n] = tex;
      return tex;
    });
  for (const n of Object.keys(POSES)) poseData[n] = poseUniforms(n);
  await loadPose(HERO_SHOT.pose);
  for (const n of Object.keys(POSES)) if (+n !== HERO_SHOT.pose) loadPose(n).catch(() => {});
  const texFor = (n) => textures[n] || textures[HERO_SHOT.pose];
  const dataFor = (n) => (textures[n] ? poseData[n] : poseData[HERO_SHOT.pose]);

  /* ── Shots ── */
  const entryEls = [...document.querySelectorAll('.tl-entry')];
  const worksEl = document.querySelector('.works');
  const M = Math.min(entryEls.length, NODE_SHOTS.length);
  const shots = [HERO_SHOT, ...NODE_SHOTS.slice(0, M), WORKS_SHOT].map((s) => ({
    ...s,
    target: cardPoint(s.pose, s.at, new THREE.Vector3()),
  }));

  /* ── State ── */
  const pointer = new THREE.Vector2(0, 0);
  let lastPointerAt = -1e9;
  let pointerMoved = false;
  let hasPointer = false;
  let narrow = false;
  let width = 1, height = 1;

  const goal = { target: new THREE.Vector3(), dist: 6, az: 0, el: 0, shift: 0, blur: 0 };
  const cur = { target: new THREE.Vector3(), dist: 6, az: 0, el: 0, shift: 0, blur: 0 };
  const look = new THREE.Vector2();
  const faceNdc = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let initialised = false;
  let tilt = 0;
  let poseMix = 0;
  let flip = 0; // the turn-around into the works section, in radians

  // Scroll position → a continuous shot index: 0 = hero, k = résumé entry k, M+1 = works.
  function shotIndex() {
    const vh = window.innerHeight;
    const line = vh * CAM.nodeLine;
    if (!M) return 0;
    const tops = entryEls.slice(0, M).map((el) => el.getBoundingClientRect().top);

    if (tops[0] > line) {
      const travel = Math.max(1, tops[0] + window.scrollY - line);
      return clamp(1 - (tops[0] - line) / travel, 0, 1);
    }
    for (let k = 0; k < M - 1; k++) {
      if (tops[k + 1] > line) return k + 1 + (line - tops[k]) / (tops[k + 1] - tops[k]);
    }
    const worksTop = worksEl ? worksEl.getBoundingClientRect().top : vh;
    return M + clamp((vh - worksTop) / (vh * 0.5), 0, 1);
  }

  let seg = 0, rawIndex = 0;
  function computeGoal() {
    rawIndex = shotIndex();
    seg = Math.min(Math.floor(rawIndex), shots.length - 2);
    // Ease across the segment, then rest on the stop for the last `dwell` share of it.
    const lin = clamp((rawIndex - seg) / (1 - CAM.dwell), 0, 1);
    const t = smoother(lin);
    const a = shots[seg], b = shots[seg + 1];
    goal.target.lerpVectors(a.target, b.target, t);
    goal.dist = lerp(a.dist, b.dist, t);
    goal.az = lerp(a.az, b.az, t);
    goal.el = lerp(a.el, b.el, t);
    goal.shift = lerp(a.shift, b.shift, t);
    goal.blur = lerp(a.blur, b.blur, t);
    if (narrow) {
      goal.dist *= CAM.mobilePullback;
      goal.shift = 0;
    }
    if (seg === shots.length - 2) {
      // Into the works section the character turns away, edge-on, and comes back round in
      // its next pose (the reference's character turns its head here).
      const half = lin < 0.5;
      const e = smoother(half ? lin * 2 : (lin - 0.5) * 2);
      flip = half ? e * Math.PI * 0.5 : -(1 - e) * Math.PI * 0.5;
      poseMix = half ? 0 : 1;
    } else {
      flip = 0;
      // The pose changes in the middle of the move, not across all of it.
      poseMix = a.pose === b.pose ? 0 : smoothstep(lin, 0.3, 0.72);
    }
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    narrow = width <= 640 || width / height < 0.8;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    pointerMoved = true;
    hasPointer = true;
  }, { passive: true });

  /* ── Frame ── */
  const clock = new THREE.Clock();
  let elapsed = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    const t = elapsed;

    // Camera: scroll picks the shot, damping makes the move
    computeGoal();
    if (!initialised) {
      cur.target.copy(goal.target);
      cur.dist = goal.dist; cur.az = goal.az; cur.el = goal.el; cur.shift = goal.shift; cur.blur = goal.blur;
      initialised = true;
    }
    const k = reducedMotion ? 40 : CAM.damping;
    cur.target.x = damp(cur.target.x, goal.target.x, k, dt);
    cur.target.y = damp(cur.target.y, goal.target.y, k, dt);
    cur.dist = damp(cur.dist, goal.dist, k, dt);
    cur.az = damp(cur.az, goal.az, k, dt);
    cur.el = damp(cur.el, goal.el, k, dt);
    cur.shift = damp(cur.shift, goal.shift, k, dt);
    cur.blur = damp(cur.blur, goal.blur, k, dt);

    // Intro: the camera settles in from a little further back
    const intro = 1 - Math.pow(1 - clamp(t / 2.2, 0, 1), 4);
    const dist = cur.dist + (1 - intro) * 1.6;
    const az = degToRad(cur.az);
    const elv = degToRad(cur.el);
    const live = hasPointer && !reducedMotion ? 1 : 0;
    camera.position.set(
      cur.target.x + Math.sin(az) * Math.cos(elv) * dist,
      cur.target.y + Math.sin(elv) * dist,
      Math.cos(az) * Math.cos(elv) * dist
    );
    camera.lookAt(cur.target);
    camera.translateX(pointer.x * CAM.parallax * (dist / 5) * live);
    camera.translateY(pointer.y * CAM.parallax * 0.6 * (dist / 5) * live);
    camera.lookAt(cur.target);

    // Slide the subject sideways to make room for the text column (and lift it on phones)
    const lift = narrow ? CAM.mobileLift * clamp(rawIndex, 0, 1) : 0;
    if (Math.abs(cur.shift) > 0.001 || lift > 0.001) {
      camera.setViewOffset(width, height, cur.shift * width, lift * height, width, height);
    } else if (camera.view) {
      camera.clearViewOffset();
    }
    camera.updateMatrixWorld();

    // Which poses are on the card right now
    const a = shots[seg], b = shots[seg + 1];
    const da = dataFor(a.pose), db = dataFor(b.pose);
    U.uTexA.value = texFor(a.pose); U.uTexB.value = texFor(b.pose);
    U.uEyesA.value.copy(da.eyes); U.uEyesB.value.copy(db.eyes);
    U.uEyeRA.value.copy(da.eyeR); U.uEyeRB.value.copy(db.eyeR);
    U.uPxA.value.copy(da.px); U.uPxB.value.copy(db.px);
    U.uMix.value = poseMix;
    U.uNeck.value = lerp(da.neck, db.neck, poseMix);
    // Focus follows the point the camera is aimed at (card units → UV)
    U.uFocus.value.set(cur.target.x / CARD.w + 0.5, cur.target.y / CARD.h + 0.5);
    U.uBlur.value = cur.blur;

    // Attention: where is the cursor relative to the face on screen?
    const facePose = poseMix > 0.5 ? b.pose : a.pose;
    const eyes = POSES[facePose].eyes;
    cardPoint(facePose, [(eyes[0][0] + eyes[1][0]) / 2, (eyes[0][1] + eyes[1][1]) / 2], tmp);
    faceNdc.copy(tmp).project(camera);
    if (pointerMoved) { lastPointerAt = t; pointerMoved = false; }
    const idle = !hasPointer || t - lastPointerAt > 6;
    let gx, gy;
    if (idle) {
      gx = Math.sin(t * 0.43) * 0.5;
      gy = Math.sin(t * 0.31 + 1.3) * 0.25;
    } else {
      gx = clamp((pointer.x - faceNdc.x) * 1.4, -1, 1);
      gy = clamp((pointer.y - faceNdc.y) * 1.4, -1, 1);
    }
    look.x = damp(look.x, gx, 9, dt);
    look.y = damp(look.y, gy, 9, dt);
    U.uGaze.value.copy(look);

    const still = reducedMotion ? 0 : 1;
    U.uHead.value.set(look.x * LIFE.headLean * still, look.y * LIFE.headLean * 0.45 * still);
    U.uLean.value = (look.x * LIFE.bodyLean + Math.sin(t * 0.7) * 0.012) * still;
    U.uBreath.value = Math.sin(t * 1.5) * LIFE.breathe * still;

    // The card turns to face the cursor, bobs gently, and pops a little as the pose changes
    const g = character.group;
    tilt = damp(tilt, look.x * LIFE.tilt * still, 5, dt);
    g.rotation.y = tilt + (reducedMotion ? 0 : flip);
    g.rotation.x = damp(g.rotation.x, -look.y * LIFE.tilt * 0.45 * still, 5, dt);
    g.position.y = Math.sin(t * 1.1) * 0.02 * still - (1 - intro) * 0.5;
    g.scale.setScalar(1 + Math.sin(Math.PI * poseMix) * 0.025);

    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(frame);
  frame(); // make sure there is a first frame before the loader lifts

  // `uniforms` and `shots` are exposed for tuning from the console (window.__stage).
  return { three: { scene, camera, renderer, character: character.group }, uniforms: U, shots };
}
