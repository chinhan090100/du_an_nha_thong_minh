/* =============================================================
   three-house.js — Scene WebGL "Ngôi nhà thông minh"
   Mô hình procedural + env map + kính truyền sáng + gable roof
   + mưa vệt/splash + khói mềm + grade hậu kỳ + theme ngày/đêm
   ============================================================= */
(function (window, document) {
  'use strict';

  var House3D = (window.House3D = window.House3D || {});
  var Core = window.Core || {};
  var clamp = Core.clamp || function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  var state = {
    renderer: null,
    scene: null,
    camera: null,
    composer: null,
    bloom: null,
    grade: null,
    clock: null,
    group: null,
    house: null,
    env: null,
    lights: {},
    windows: [],
    glass: [],
    rain: null,
    rainDrops: [],
    splashes: [],
    smoke: null,
    pmrem: null,
    envRT: null,
    raf: null,
    running: false,
    visible: true,
    inView: true,
    reduced: false,
    dpr: 1,
    quality: 'high',
    theme: 'day',
    themeMix: 0,
    textures: [],
    lastFov: 42,
    camZ: 11.5,
    lightsOn: true,
    rainOn: false,
    sensorsVisible: false,
    autoTour: true,
    spinOn: true,
    tour: null,
    tourTimer: null,
    fpsSamples: [],
    degradeLevel: 0,
  };

  /* ---------------------------------------------------------------
     TƯƠNG TÁC
     --------------------------------------------------------------- */
  var drag = {
    active: false,
    x: 0, y: 0,
    rotX: 0.2, rotY: -0.45,
    targetRotX: 0.2, targetRotY: -0.45,
    velX: 0, velY: 0,
    lastInteract: 0,
    zoom: 1, targetZoom: 1,
  };

  var COLORS = {
    wall: 0xf3f7fb,
    wallSide: 0xdfe8f2,
    roof: 0x2f8f5b,
    roofDark: 0x186b43,
    door: 0x38bdf8,
    window: 0xfbbf24,
    wood: 0x8b5e3c,
    leaf: 0x4ade80,
    leafDark: 0x16a34a,
    ground: 0x7dd3a0,
    groundDark: 0x3f9e6b,
    stone: 0x94a3b8,
    glowGreen: 0x4ade80,
    glowBlue: 0x22d3ee,
    glowViolet: 0xa78bfa,
  };

  /* ---------------------------------------------------------------
     PRESET THEME
     --------------------------------------------------------------- */
  var THEMES = {
    day: {
      fog: 0xd8e8f2,
      fogDensity: 0.014,
      hemiSky: 0xcfe8fb,
      hemiGround: 0x3f6b52,
      hemiInt: 0.55,
      sun: 0xfff2dc,
      sunInt: 1.15,
      sunPos: [7, 12, 8],
      exposure: 0.94,
      bloom: 0.22,
      bloomThreshold: 0.95,
      winEmissive: 0.22,
      lampInt: 0.4,
      ground: 0x63c48f,
      soil: 0x3d9a6b,
      sky: ['#7fc0f0', '#cfe6f7', '#f2f8fb'],
      envInt: 0.85,
      rimInt: 0.1,
      bg: 0xbcdcf0,
      wall: 0xf3f7fb,
      wallSide: 0xdfe8f2,
      frame: 0xf8fafc,
      wood: 0x8b5e3c,
      leaf: 0x4ade80,
      leafDark: 0x16a34a,
      path: 0xd6cbb8,
      step: 0x94a3b8,
      fence: 0xe8dcc8,
    },
    night: {
      fog: 0x050b18,
      fogDensity: 0.026,
      hemiSky: 0x22355a,
      hemiGround: 0x070f1c,
      hemiInt: 0.42,
      sun: 0x8fb4ff,
      sunInt: 0.34,
      sunPos: [-6, 11, -7],
      exposure: 1.12,
      bloom: 0.5,
      bloomThreshold: 0.82,
      winEmissive: 1.5,
      lampInt: 1.6,
      ground: 0x27455c,
      soil: 0x162b3a,
      sky: ['#03060f', '#081226', '#0e1b34'],
      envInt: 0.42,
      rimInt: 1.5,
      bg: 0x081226,
      wall: 0x2c3a52,
      wallSide: 0x202c40,
      frame: 0x44536b,
      wood: 0x4a3324,
      leaf: 0x2f6b4a,
      leafDark: 0x1d4730,
      path: 0x4a5568,
      step: 0x515f74,
      fence: 0x4c5464,
    },
  };

  /* ---------------------------------------------------------------
     KHỞI TẠO
     --------------------------------------------------------------- */
  House3D.init = function (container) {
    if (!container) return false;
    if (!window.THREE) {
      container.classList.add('is-fallback');
      /* KHÔNG ghi đè innerHTML — console3d đang nằm trong .hero__stage,
         xoá sạch sẽ làm mất console. Thay vào đó chèn fallback vào div riêng. */
      var fb = document.createElement('div');
      fb.className = 'css-house';
      fb.innerHTML =
        '<div class="css-house__roof"></div>' +
        '<div class="css-house__body"></div>' +
        '<div class="css-house__door"></div>' +
        '<div class="css-house__win css-house__win--l"></div>' +
        '<div class="css-house__win css-house__win--r"></div>';
      container.appendChild(fb);
      return false;
    }

    var T = window.THREE;
    /* ĐO bằng clientWidth/clientHeight — KHÔNG dùng getBoundingClientRect().
       Hero timeline áp `scale(0.86) + rotateY(-22deg)` lên .hero__stage nên
       rect bị biến dạng → canvas sai tỉ lệ → camera aspect sai → nhà bị méo. */
    var w = container.clientWidth || container.offsetWidth || 600;
    var h = container.clientHeight || container.offsetHeight || 600;
    var isMobile = window.innerWidth < 900;

    var cores = navigator.hardwareConcurrency || 8;
    var weakDevice = cores > 0 && cores <= 2;
    state.quality = isMobile || weakDevice ? 'low' : 'high';
    state.reduced = !!(window.Vendor && window.Vendor.reducedMotion);
    state.dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75);

    try {
      state.renderer = new T.WebGLRenderer({
        antialias: state.quality === 'high' && !isMobile,
        alpha: true,
        // KHÔNG dùng preserveDrawingBuffer: chỉ cần cho screenshot debug,
        // nhưng gây giảm fps đáng kể trên Chrome.
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
        stencil: false,
      });
    } catch (e) {
      container.classList.add('is-fallback');
      return false;
    }

    state.renderer.setPixelRatio(state.dpr);
    state.renderer.setSize(w, h);
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = T.PCFSoftShadowMap;
    state.renderer.toneMapping = T.ACESFilmicToneMapping;
    state.renderer.toneMappingExposure = THEMES.day.exposure;
    container.appendChild(state.renderer.domElement);

    /* --- Scene --- */
    state.scene = new T.Scene();
    state.scene.fog = new T.FogExp2(THEMES.day.fog, THEMES.day.fogDensity);
    // Nền đục (không trong suốt) để scene không bị "cháy" trắng khi chồng lên nền web
    state.scene.background = new T.Color(THEMES.day.bg);

    state.camera = new T.PerspectiveCamera(42, w / h, 0.1, 120);
    state.camera.position.set(0, 3.4, 11.5);
    state.camera.lookAt(0, 1.6, 0);

    buildEnvironmentMap(T);
    buildLights(T);
    buildHouse(T);
    buildGround(T);
    buildSurroundings(T);
    buildRain(T);
    buildSmoke(T);
    buildSplashes(T);

    /* --- Postprocessing --- */
    setupComposer(T, w, h);

    state.clock = new T.Clock();
    bindEvents(container);
    start();

    House3D.scene = state;

    /* Choreography tự động sau khi hero timeline (2.4s) */
    if (!state.reduced) {
      state.tourTimer = window.setTimeout(function () {
        House3D.playIntroTour();
      }, 2400);
    }

    return true;
  };

  /* ---------------------------------------------------------------
     MÔI TRƯỜNG PHẢN XẠ PROCEDURAL (không cần file ngoài)
     --------------------------------------------------------------- */
  function buildEnvironmentMap(T) {
    try {
      state.pmrem = new T.PMREMGenerator(state.renderer);
      state.pmrem.compileEquirectangularShader();
    } catch (e) {
      state.pmrem = null;
    }
    refreshEnvMap(T, THEMES.day);
  }

  function makeSkyTexture(T, colors) {
    var c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    var ctx = c.getContext('2d');

    var g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, colors[0]);
    g.addColorStop(0.45, colors[1]);
    g.addColorStop(0.55, colors[2]);
    g.addColorStop(1, colors[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);

    // Mặt trời / quầng sáng
    var sun = ctx.createRadialGradient(150, 70, 4, 150, 70, 120);
    sun.addColorStop(0, 'rgba(255,255,255,0.95)');
    sun.addColorStop(0.25, 'rgba(255,240,200,0.45)');
    sun.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, 512, 256);

    // Đám mây mềm
    ctx.globalAlpha = 0.16;
    for (var i = 0; i < 26; i++) {
      var cx = Math.random() * 512;
      var cy = 30 + Math.random() * 80;
      var r = 18 + Math.random() * 52;
      var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      cg.addColorStop(0, 'rgba(255,255,255,0.9)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    var tex = new T.CanvasTexture(c);
    tex.mapping = T.EquirectangularReflectionMapping;
    tex.encoding = T.sRGBEncoding;
    state.textures.push(tex);
    return tex;
  }

  function refreshEnvMap(T, preset) {
    if (!state.pmrem || !state.scene) return;
    var tex = makeSkyTexture(T, preset.sky);
    var rt = null;
    try {
      rt = state.pmrem.fromEquirectangular(tex);
    } catch (e) {
      rt = null;
    }
    if (rt) {
      if (state.envRT) state.envRT.dispose();
      state.envRT = rt;
      state.scene.environment = rt.texture;
    }
  }

  /* ---------------------------------------------------------------
     TEXTURE THỦ TỤC
     --------------------------------------------------------------- */
  function makeNoiseTexture(T, base, spec, size, repeat) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // Vết / vân ngẫu nhiên
    for (var i = 0; i < size * 3; i++) {
      var x = Math.random() * size;
      var y = Math.random() * size;
      var len = 4 + Math.random() * 22;
      ctx.strokeStyle = 'rgba(' + spec + ',' + (0.03 + Math.random() * 0.07).toFixed(3) + ')';
      ctx.lineWidth = 0.6 + Math.random() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 8, y + len);
      ctx.stroke();
    }

    var tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(repeat || 2, repeat || 2);
    tex.encoding = T.sRGBEncoding;
    state.textures.push(tex);
    return tex;
  }

  function makeSoftSprite(T) {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.32, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);

    var tex = new T.CanvasTexture(c);
    state.textures.push(tex);
    return tex;
  }

  function makeRoofTexture(T) {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#2f8f5b';
    ctx.fillRect(0, 0, 256, 256);

    // Hàng gạch
    var rowH = 16;
    for (var r = 0; r < 256 / rowH; r++) {
      var off = r % 2 ? 16 : 0;
      for (var x = -32; x < 256; x += 32) {
        var y = r * rowH;
        ctx.strokeStyle = 'rgba(0,0,0,0.16)';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x + off + 1, y + 1, 30, rowH - 2);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.02 + Math.random() * 0.05).toFixed(3) + ')';
        ctx.fillRect(x + off + 1, y + 1, 30, rowH - 2);
      }
    }

    var tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(4, 3);
    tex.encoding = T.sRGBEncoding;
    state.textures.push(tex);
    return tex;
  }

  function makeShadowTexture(T) {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(128, 128, 10, 128, 128, 126);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.26)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    var tex = new T.CanvasTexture(c);
    state.textures.push(tex);
    return tex;
  }

  /* ---------------------------------------------------------------
     ÁNH SÁNG
     --------------------------------------------------------------- */
  function buildLights(T) {
    var hemi = new T.HemisphereLight(
      THEMES.day.hemiSky,
      THEMES.day.hemiGround,
      THEMES.day.hemiInt
    );
    state.scene.add(hemi);

    var sun = new T.DirectionalLight(THEMES.day.sun, THEMES.day.sunInt);
    sun.position.set(
      THEMES.day.sunPos[0],
      THEMES.day.sunPos[1],
      THEMES.day.sunPos[2]
    );
    sun.castShadow = true;
    sun.shadow.mapSize.width = state.quality === 'high' ? 1536 : 1024;
    sun.shadow.mapSize.height = state.quality === 'high' ? 1536 : 1024;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 45;
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    sun.shadow.bias = -0.0009;
    sun.shadow.normalBias = 0.02;
    state.scene.add(sun);

    // Đèn neon nhấp nháy nhẹ (trước nhà)
    var pl1 = new T.PointLight(COLORS.glowGreen, 1.35, 22, 2);
    pl1.position.set(-4.6, 3.2, 4.6);
    state.scene.add(pl1);

    var pl2 = new T.PointLight(COLORS.glowBlue, 1.05, 22, 2);
    pl2.position.set(4.6, 2.4, -4.2);
    state.scene.add(pl2);

    // Neon rim light phía sau (tạo viền sáng quanh nhà)
    var rim1 = new T.PointLight(COLORS.glowBlue, 0.6, 18, 2);
    rim1.position.set(-3.5, 4.2, -5.5);
    state.scene.add(rim1);

    var rim2 = new T.PointLight(COLORS.glowViolet, 0.6, 18, 2);
    rim2.position.set(4.2, 3.4, -5.2);
    state.scene.add(rim2);

    state.lights = { hemi: hemi, sun: sun, pl1: pl1, pl2: pl2, rim1: rim1, rim2: rim2 };
  }

  /* ---------------------------------------------------------------
     MÔ HÌNH NHÀ
     --------------------------------------------------------------- */
  function buildHouse(T) {
    var g = new T.Group();
    state.group = g;
    state.scene.add(g);

    var house = new T.Group();
    house.position.y = 0.35;
    g.add(house);
    state.house = house;

    var usePhys = state.quality === 'high';

    /* --- Tường --- */
    var wallTex = makeNoiseTexture(T, '#f3f7fb', '120,140,160', 256, 3);
    var wallMat = new T.MeshStandardMaterial({
      color: COLORS.wall,
      roughness: 0.74,
      metalness: 0.03,
      map: wallTex,
    });
    var wallSideMat = new T.MeshStandardMaterial({
      color: COLORS.wallSide,
      roughness: 0.8,
      map: wallTex,
    });

    var walls = new T.Mesh(new T.BoxGeometry(5.2, 3.1, 4.2), [
      wallSideMat, wallSideMat, wallMat, wallMat, wallSideMat, wallSideMat,
    ]);
    walls.position.y = 1.55;
    walls.castShadow = true;
    walls.receiveShadow = true;
    house.add(walls);

    // Viền trang trí
    var trimMat = new T.MeshStandardMaterial({
      color: 0xe6edf5,
      roughness: 0.55,
      metalness: 0.08,
    });
    var trim = new T.Mesh(new T.BoxGeometry(5.4, 0.16, 4.4), trimMat);
    trim.position.y = 0.12;
    trim.castShadow = true;
    house.add(trim);

    // Đế / nền móng
    var baseMat = new T.MeshStandardMaterial({
      color: 0xb9c4d0,
      roughness: 0.88,
    });
    var base = new T.Mesh(new T.BoxGeometry(5.45, 0.28, 4.45), baseMat);
    base.position.y = 0.14;
    base.castShadow = true;
    base.receiveShadow = true;
    house.add(base);

    /* --- Mái nhà: GABLE ROOF (gable = 2 mặt) --- */
    var roofTex = makeRoofTexture(T);
    var roofMat = new T.MeshStandardMaterial({
      color: 0xffffff,
      map: roofTex,
      roughness: 0.62,
      metalness: 0.06,
    });
    var roofDarkMat = new T.MeshStandardMaterial({
      color: COLORS.roofDark,
      roughness: 0.7,
    });

    // Hai mặt mái nghiêng
    var slope = 1.62;
    var pitch = 0.95;
    var roofLen = 5.9;

    [-1, 1].forEach(function (side) {
      var panel = new T.Mesh(new T.BoxGeometry(roofLen, 0.16, slope), roofMat);
      panel.position.set(0, 3.12 + slope / 2 - 0.12, side * (4.2 / 4 + slope / 4));
      panel.rotation.x = side * pitch;
      panel.castShadow = true;
      panel.receiveShadow = true;
      house.add(panel);

      // Gờ mái (fascia)
      var fascia = new T.Mesh(
        new T.BoxGeometry(roofLen + 0.14, 0.2, 0.16),
        roofDarkMat
      );
      fascia.position.set(
        0,
        3.12 + slope / 2 - 0.12 - slope / 2 * Math.cos(pitch) + 0.06,
        side * (4.2 / 4 + slope / 4 + slope / 2 * Math.cos(pitch) * 0.92)
      );
      fascia.rotation.x = side * pitch;
      fascia.castShadow = true;
      house.add(fascia);
    });

    // Đường đỉnh mái (ridge)
    var ridge = new T.Mesh(new T.BoxGeometry(roofLen + 0.2, 0.18, 0.26), roofDarkMat);
    ridge.position.y = 3.12 + slope * Math.cos(pitch) - 0.1;
    ridge.castShadow = true;
    house.add(ridge);

    // Mặt trước tam giác (gable end)
    var gableShape = new T.Shape();
    gableShape.moveTo(-2.1, 0);
    gableShape.lineTo(2.1, 0);
    gableShape.lineTo(0, 2.5);
    gableShape.closePath();

    var gableGeo = new T.ExtrudeGeometry(gableShape, { depth: 0.14, bevelEnabled: false });
    gableGeo.translate(0, 0, -0.07);

    [-2.1, 2.1].forEach(function (z) {
      var gable = new T.Mesh(gableGeo, wallMat);
      gable.position.set(0, 3.1, z);
      gable.castShadow = true;
      house.add(gable);
    });

    // Xà gia trang trí ở gable
    [-2.1, 2.1].forEach(function (z) {
      var beamMat = new T.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.6,
      });
      var beam = new T.Mesh(new T.BoxGeometry(4.3, 0.14, 0.1), beamMat);
      beam.position.set(0, 3.42, z + (z > 0 ? 0.09 : -0.09));
      beam.castShadow = true;
      house.add(beam);
    });

    /* --- Gương mái (dormer) --- */
    var dormer = new T.Group();
    var dBody = new T.Mesh(new T.BoxGeometry(1.5, 1.05, 1.35), wallMat);
    dBody.position.y = 0.52;
    dBody.castShadow = true;
    dormer.add(dBody);

    var dRoof = new T.Mesh(new T.ConeGeometry(1.18, 0.72, 4), roofDarkMat);
    dRoof.rotation.y = Math.PI / 4;
    dRoof.position.y = 1.38;
    dRoof.scale.set(1.12, 1, 0.9);
    dRoof.castShadow = true;
    dormer.add(dRoof);

    var dGlass = new T.Mesh(
      new T.PlaneGeometry(0.8, 0.66),
      new T.MeshStandardMaterial({
        color: 0xffe9a8,
        emissive: COLORS.window,
        emissiveIntensity: 0.5,
        roughness: 0.18,
      })
    );
    dGlass.position.set(0, 0.55, 0.69);
    dormer.add(dGlass);
    state.glass.push(dGlass);

    dormer.position.set(-1.35, 3.35, 0.95);
    house.add(dormer);

    /* --- Cửa --- */
    var doorMat = new T.MeshStandardMaterial({
      color: COLORS.door,
      roughness: 0.38,
      metalness: 0.16,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.3,
    });
    var door = new T.Mesh(new T.BoxGeometry(1.05, 1.95, 0.14), doorMat);
    door.position.set(0, 0.98, 2.14);
    door.castShadow = true;
    house.add(door);

    // Khung cửa
    var doorFrame = new T.Mesh(
      new T.BoxGeometry(1.25, 2.12, 0.08),
      new T.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
    );
    doorFrame.position.set(0, 1.02, 2.08);
    house.add(doorFrame);

    var knob = new T.Mesh(
      new T.SphereGeometry(0.075, 16, 16),
      new T.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.25 })
    );
    knob.position.set(0.36, 0.95, 2.24);
    house.add(knob);

    // Bậc cửa
    var stepMat = new T.MeshStandardMaterial({ color: COLORS.stone, roughness: 0.9 });
    state.stepMat = stepMat;
    for (var i = 0; i < 2; i++) {
      var step = new T.Mesh(
        new T.BoxGeometry(1.5 + i * 0.35, 0.16, 0.5 + i * 0.25),
        stepMat
      );
      step.position.set(0, 0.08 - i * 0.08, 2.45 + i * 0.28);
      step.castShadow = true;
      step.receiveShadow = true;
      house.add(step);
    }

    /* --- NHÓM CẢM BIẾN (bật/tắt bằng lệnh `sensors`) --- */
    var sensorGroup = new T.Group();
    sensorGroup.visible = false;
    house.add(sensorGroup);
    state.sensorsGroup = sensorGroup;

    function addSensorMarker(x, y, z, color) {
      var g = new T.Group();
      g.position.set(x, y, z);

      var pin = new T.Mesh(
        new T.CylinderGeometry(0.03, 0.03, 0.5, 8),
        new T.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.4 })
      );
      pin.position.y = -0.25;
      g.add(pin);

      var bulb = new T.Mesh(
        new T.SphereGeometry(0.17, 16, 16),
        new T.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 1.6,
          roughness: 0.25,
        })
      );
      g.add(bulb);

      var halo = new T.Mesh(
        new T.RingGeometry(0.26, 0.34, 24),
        new T.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.55,
          side: T.DoubleSide,
          depthWrite: false,
        })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = -0.02;
      g.add(halo);

      g.userData.bulb = bulb;
      g.userData.halo = halo;
      sensorGroup.add(g);
      return g;
    }

    state.sensorMarkers = [
      addSensorMarker(-1.85, 5.95, 0.6, 0x22d3ee),
      addSensorMarker(1.55, 5.8, -0.9, 0xf472b6),
      addSensorMarker(2.65, 2.7, -0.7, 0xfbbf24),
      addSensorMarker(-2.65, 2.7, 0.7, 0xa78bfa),
      addSensorMarker(0, 2.6, 2.25, 0x4ade80),
    ];

    // Đường dẫn
    var pathMat = new T.MeshStandardMaterial({ color: 0xd6cbb8, roughness: 0.95 });
    state.pathMat = pathMat;    for (var p = 0; p < 5; p++) {
      var tile = new T.Mesh(new T.BoxGeometry(1.25, 0.08, 0.62), pathMat);
      tile.position.set(0, 0.06, 2.9 + p * 0.72);
      tile.receiveShadow = true;
      house.add(tile);
    }

    /* --- Đèn trước cửa --- */
    var lampMat = new T.MeshStandardMaterial({
      color: 0xfff4c2,
      emissive: 0xffd166,
      emissiveIntensity: 1.4,
    });
    var lamp = new T.Mesh(new T.SphereGeometry(0.13, 16, 16), lampMat);
    lamp.position.set(0, 2.18, 2.3);
    house.add(lamp);
    var lampLight = new T.PointLight(0xffd166, 0.9, 7, 2);
    lampLight.position.set(0, 2.18, 2.6);
    house.add(lampLight);
    state.lamp = lamp;
    state.lampLight = lampLight;

    // Vòm đèn trên cửa
    var canopy = new T.Mesh(
      new T.BoxGeometry(0.8, 0.08, 0.42),
      new T.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 })
    );
    canopy.position.set(0, 2.42, 2.28);
    canopy.castShadow = true;
    house.add(canopy);

    /* --- CỬA SỔ: kính truyền sáng + khung gỗ --- */
    var frameMat = new T.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.52,
      metalness: 0.05,
    });
    var woodMat = new T.MeshStandardMaterial({
      color: COLORS.wood,
      roughness: 0.78,
    });

    var glassMat = usePhys
      ? new T.MeshPhysicalMaterial({
          color: 0xdff3ff,
          transmission: 0.92,
          roughness: 0.06,
          metalness: 0,
          ior: 1.5,
          thickness: 0.22,
          transparent: true,
          opacity: 1,
          emissive: COLORS.window,
          emissiveIntensity: 0.22,
        })
      : new T.MeshStandardMaterial({
          color: 0xbfe4ff,
          emissive: COLORS.window,
          emissiveIntensity: 0.22,
          roughness: 0.16,
          metalness: 0.1,
          transparent: true,
          opacity: 0.88,
        });

    var winPositions = [
      [-1.55, 1.9, 2.12, 0],
      [1.55, 1.9, 2.12, 0],
      [-1.55, 1.9, -2.12, Math.PI],
      [1.55, 1.9, -2.12, Math.PI],
      [2.61, 1.9, 0.7, Math.PI / 2],
      [2.61, 1.9, -0.7, Math.PI / 2],
      [-2.61, 1.9, 0.7, -Math.PI / 2],
      [-2.61, 1.9, -0.7, -Math.PI / 2],
    ];

    winPositions.forEach(function (p) {
      var wg = new T.Group();
      wg.position.set(p[0], p[1], p[2]);
      wg.rotation.y = p[3];

      var glass = new T.Mesh(new T.PlaneGeometry(0.86, 0.86), glassMat.clone());
      glass.userData.baseEmissive = 0.22;
      glass.position.z = 0.01;
      wg.add(glass);

      // Khung gỗ ngoài
      var outer = new T.Mesh(new T.BoxGeometry(1.06, 1.06, 0.1), woodMat);
      outer.position.z = -0.05;
      outer.castShadow = true;
      wg.add(outer);

      var inner = new T.Mesh(new T.BoxGeometry(0.92, 0.92, 0.13), frameMat);
      inner.position.z = -0.02;
      wg.add(inner);

      // Vạch chia
      var barV = new T.Mesh(new T.BoxGeometry(0.06, 0.92, 0.13), frameMat);
      wg.add(barV);
      var barH = new T.Mesh(new T.BoxGeometry(0.92, 0.06, 0.13), frameMat);
      wg.add(barH);

      // Bệ cửa sổ
      var sill = new T.Mesh(new T.BoxGeometry(1.16, 0.08, 0.26), frameMat);
      sill.position.set(0, -0.56, 0.04);
      sill.castShadow = true;
      wg.add(sill);

      house.add(wg);
      state.windows.push(glass);
      state.glass.push(glass);
    });

    // Ánh sáng trong phòng hắt ra qua kính (ngày: yếu, đêm: mạnh)
    var inner1 = new T.PointLight(0xffd9a0, 0.4, 7, 2);
    inner1.position.set(-1.4, 2.0, 1.2);
    house.add(inner1);
    var inner2 = new T.PointLight(0xffd9a0, 0.4, 7, 2);
    inner2.position.set(1.4, 2.0, -1.0);
    house.add(inner2);
    state.innerLights = [inner1, inner2];

    /* --- Ống khói --- */
    var chimneyMat = new T.MeshStandardMaterial({
      color: 0x9ca3af,
      roughness: 0.85,
    });
    var chimney = new T.Mesh(new T.BoxGeometry(0.52, 1.6, 0.52), chimneyMat);
    chimney.position.set(1.55, 4.62, -0.9);
    chimney.castShadow = true;
    house.add(chimney);

    var chimneyCap = new T.Mesh(
      new T.BoxGeometry(0.74, 0.14, 0.74),
      new T.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.8 })
    );
    chimneyCap.position.set(1.55, 5.42, -0.9);
    chimneyCap.castShadow = true;
    house.add(chimneyCap);

    /* --- Ănten / cảm biến trên nóc --- */
    var antenna = new T.Mesh(
      new T.CylinderGeometry(0.035, 0.035, 1.7, 8),
      new T.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.35 })
    );
    antenna.position.set(-1.85, 5.0, 0.6);
    house.add(antenna);

    var sensor = new T.Mesh(
      new T.SphereGeometry(0.12, 16, 16),
      new T.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x22d3ee,
        emissiveIntensity: 1.2,
      })
    );
    sensor.position.set(-1.85, 5.88, 0.6);
    house.add(sensor);
    state.sensor = sensor;

    /* --- Bảng solar ở mái --- */
    var panelMat = new T.MeshPhysicalMaterial({
      color: 0x14336e,
      roughness: 0.16,
      metalness: 0.72,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      emissive: 0x0a1c46,
      emissiveIntensity: 0.4,
    });
    var panel = new T.Mesh(new T.BoxGeometry(1.95, 0.08, 1.3), panelMat);
    panel.position.set(-1.3, 4.12, 0.3);
    panel.rotation.x = -0.42;
    panel.rotation.z = 0.12;
    panel.castShadow = true;
    house.add(panel);

    // Khung bảng solar
    var panelFrame = new T.Mesh(
      new T.BoxGeometry(2.06, 0.05, 1.4),
      new T.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 })
    );
    panelFrame.position.set(-1.3, 4.08, 0.3);
    panelFrame.rotation.x = -0.42;
    panelFrame.rotation.z = 0.12;
    house.add(panelFrame);

    /* --- Dải emissive gờ mái (neon trim) --- */
    var trimStrip = new T.Mesh(
      new T.BoxGeometry(roofLen - 0.2, 0.05, 0.07),
      new T.MeshBasicMaterial({ color: 0x67e8f9 })
    );
    trimStrip.position.set(0, 3.1 + slope * Math.cos(pitch) - 0.22, 0);
    house.add(trimStrip);
    state.trimStrip = trimStrip;

    /* --- Registry vật liệu để đổi màu theo theme --- */
    state.mat = {
      wall: wallMat,
      wallSide: wallSideMat,
      roof: roofMat,
      roofDark: roofDarkMat,
      frame: frameMat,
      wood: woodMat,
      glass: glassMat,
      trim: trimMat,
      base: baseMat,
      door: doorMat,
    };
  }

  /* ---------------------------------------------------------------
     SÂN + BÓNG GIẢ
     --------------------------------------------------------------- */
  function buildGround(T) {
    var env = new T.Group();
    state.scene.add(env);
    state.env = env;

    var groundMat = new T.MeshPhysicalMaterial({
      color: COLORS.ground,
      roughness: 0.82,
      metalness: 0.02,
      clearcoat: 0.55,
      clearcoatRoughness: 0.42,
    });
    var ground = new T.Mesh(new T.CylinderGeometry(9.5, 9.9, 0.55, 64), groundMat);
    ground.position.y = -0.32;
    ground.receiveShadow = true;
    env.add(ground);
    state.ground = ground;
    state.groundMat = groundMat;

    var soil = new T.Mesh(
      new T.CylinderGeometry(9.2, 9.5, 0.2, 48),
      new T.MeshStandardMaterial({ color: COLORS.groundDark, roughness: 1 })
    );
    soil.position.y = -0.58;
    env.add(soil);
    state.soilMat = soil.material;

    // Vệt bóng mờ dưới chân nhà
    var shadow = new T.Mesh(
      new T.PlaneGeometry(9, 7.6),
      new T.MeshBasicMaterial({
        map: makeShadowTexture(T),
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.035;
    shadow.renderOrder = -1;
    env.add(shadow);
  }

  /* ---------------------------------------------------------------
     CÂY, HÀNG RÀO, ĐÈN ĐƯỜNG
     --------------------------------------------------------------- */
  function buildSurroundings(T) {
    var env = state.env;

    var treePositions = [
      [-5.2, -1.6, 1.15], [5.0, -2.4, 0.95], [-4.2, 3.4, 0.8],
      [4.6, 2.6, 1.05], [-6.2, 1.2, 0.7],
    ];
    var trunkMat = new T.MeshStandardMaterial({ color: COLORS.wood, roughness: 0.95 });
    var leafMat = new T.MeshStandardMaterial({
      color: COLORS.leaf, roughness: 0.85, flatShading: true,
    });
    var leafMat2 = new T.MeshStandardMaterial({
      color: COLORS.leafDark, roughness: 0.85, flatShading: true,
    });

    treePositions.forEach(function (tp, idx) {
      var tree = new T.Group();
      tree.position.set(tp[0], -0.05, tp[1]);
      tree.scale.setScalar(tp[2]);

      var trunk = new T.Mesh(new T.CylinderGeometry(0.13, 0.19, 1.5, 10), trunkMat);
      trunk.position.y = 0.75;
      trunk.castShadow = true;
      tree.add(trunk);

      var crown = new T.Mesh(new T.IcosahedronGeometry(0.82, 1), idx % 2 ? leafMat2 : leafMat);
      crown.position.y = 2.05;
      crown.castShadow = true;
      tree.add(crown);

      var crown2 = new T.Mesh(new T.IcosahedronGeometry(0.55, 1), leafMat2);
      crown2.position.set(0.42, 1.62, 0.28);
      crown2.castShadow = true;
      tree.add(crown2);

      env.add(tree);
    });

    // Hàng rào
    var fenceMat = new T.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.92 });
    state.fenceMat = fenceMat;
    for (var i = 0; i < 26; i++) {
      var ang = (i / 26) * Math.PI * 2;
      var post = new T.Mesh(new T.BoxGeometry(0.16, 0.78, 0.16), fenceMat);
      post.position.set(Math.cos(ang) * 8.6, 0.36, Math.sin(ang) * 8.6);
      post.castShadow = true;
      env.add(post);
    }

    // Đèn đường
    var poleMat = new T.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 });
    var bulbMat = new T.MeshStandardMaterial({
      color: 0xfff7d6,
      emissive: 0xffd166,
      emissiveIntensity: 2,
    });
    [-6.4, 6.4].forEach(function (x) {
      var pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 3.1, 10), poleMat);
      pole.position.set(x, 1.5, 3.4);
      pole.castShadow = true;
      env.add(pole);

      var head = new T.Mesh(new T.SphereGeometry(0.19, 16, 16), bulbMat);
      head.position.set(x, 3.05, 3.4);
      env.add(head);

      var pl = new T.PointLight(0xffd166, 0.7, 9, 2);
      pl.position.set(x, 3.05, 3.4);
      env.add(pl);
    });

    // Bụi cây nhỏ
    var bushMat = new T.MeshStandardMaterial({
      color: 0x86efac, roughness: 0.9, flatShading: true,
    });
    for (var b = 0; b < 14; b++) {
      var ang2 = (b / 14) * Math.PI * 2 + 0.4;
      var bush = new T.Mesh(new T.IcosahedronGeometry(0.34, 0), bushMat);
      bush.position.set(Math.cos(ang2) * 6.6, 0.18, Math.sin(ang2) * 6.6);
      bush.castShadow = true;
      env.add(bush);
    }
  }

  /* ---------------------------------------------------------------
     MƯA — vệt mưa dạng line segment
     --------------------------------------------------------------- */
  function buildRain(T) {
    var count = 700;
    var positions = new Float32Array(count * 6); // 2 đỉnh mỗi vệt
    var alphas = new Float32Array(count * 2);
    var drops = [];

    for (var i = 0; i < count; i++) {
      var x = (Math.random() - 0.5) * 26;
      var y = Math.random() * 18;
      var z = (Math.random() - 0.5) * 26;
      var speed = 7 + Math.random() * 8;
      var len = 0.4 + Math.random() * 0.9;
      drops.push({ x: x, y: y, z: z, speed: speed, len: len });
      alphas[i * 2] = 1;
      alphas[i * 2 + 1] = 0;
    }

    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(positions, 3));
    geo.setAttribute('aAlpha', new T.BufferAttribute(alphas, 1));

    var mat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      uniforms: {
        uColor: { value: new T.Color(0x9fd8ff) },
        uOpacity: { value: 0.55 },
      },
      vertexShader: [
        'attribute float aAlpha;',
        'varying float vAlpha;',
        'void main() {',
        '  vAlpha = aAlpha;',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'uniform float uOpacity;',
        'varying float vAlpha;',
        'void main() {',
        '  gl_FragColor = vec4(uColor, vAlpha * uOpacity);',
        '}',
      ].join('\n'),
    });

    var rain = new T.LineSegments(geo, mat);
    rain.frustumCulled = false;
    state.rain = rain;
    state.rainDrops = drops;
    state.scene.add(rain);
  }

  function updateRain(dt) {
    if (!state.rain) return;
    var drops = state.rainDrops;
    var pos = state.rain.geometry.attributes.position.array;

    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];
      d.y -= d.speed * dt;
      if (d.y < -1) {
        d.y = 17 + Math.random() * 3;
        d.x = (Math.random() - 0.5) * 26;
        d.z = (Math.random() - 0.5) * 26;
      }
      var j = i * 6;
      pos[j] = d.x;
      pos[j + 1] = d.y;
      pos[j + 2] = d.z;
      pos[j + 3] = d.x + 0.04;
      pos[j + 4] = d.y + d.len;
      pos[j + 5] = d.z;
    }
    state.rain.geometry.attributes.position.needsUpdate = true;
  }

  /* ---------------------------------------------------------------
     VÒNG NƯỚC BẮN (splash) trên mặt đất
     --------------------------------------------------------------- */
  function buildSplashes(T) {
    var ringGeo = new T.RingGeometry(0.06, 0.085, 18);
    ringGeo.rotateX(-Math.PI / 2);

    var mat = new T.MeshBasicMaterial({
      color: 0xbfe6ff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: T.DoubleSide,
    });

    for (var i = 0; i < 26; i++) {
      var ring = new T.Mesh(ringGeo, mat.clone());
      ring.visible = false;
      ring.position.y = -0.03;
      state.env.add(ring);
      state.splashes.push({ mesh: ring, t: 1, life: 0.5, x: 0, z: 0 });
    }
  }

  function updateSplashes(dt) {
    if (!state.splashes.length) return;
    for (var i = 0; i < state.splashes.length; i++) {
      var s = state.splashes[i];
      if (s.t >= 1) {
        // Sinh vòng mới ngẫu nhiên
        if (Math.random() < 0.045) {
          var ang = Math.random() * Math.PI * 2;
          var r = 2 + Math.random() * 7;
          s.x = Math.cos(ang) * r;
          s.z = Math.sin(ang) * r;
          s.t = 0;
          s.life = 0.42 + Math.random() * 0.28;
          s.mesh.visible = true;
          s.mesh.position.set(s.x, -0.03, s.z);
        }
        continue;
      }
      s.t += dt / s.life;
      var k = Math.min(s.t, 1);
      var scale = 0.4 + k * 2.6;
      s.mesh.scale.set(scale, 1, scale);
      s.mesh.material.opacity = 0.55 * (1 - k);
      if (s.t >= 1) s.mesh.visible = false;
    }
  }

  /* ---------------------------------------------------------------
     KHÓI ỐNG — hạt mềm dùng sprite texture
     --------------------------------------------------------------- */
  function buildSmoke(T) {
    var count = 90;
    var pos = new Float32Array(count * 3);
    var seed = new Float32Array(count);
    var size = new Float32Array(count);

    for (var i = 0; i < count; i++) {
      pos[i * 3] = 1.55 + (Math.random() - 0.5) * 0.22;
      pos[i * 3 + 1] = 5.5 + Math.random() * 4.5;
      pos[i * 3 + 2] = -0.9 + (Math.random() - 0.5) * 0.22;
      seed[i] = Math.random();
      size[i] = 0.5 + Math.random() * 0.9;
    }

    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    geo.setAttribute('aSize', new T.BufferAttribute(size, 1));

    var mat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uMap: { value: makeSoftSprite(T) },
        uColor: { value: new T.Color(0xdfe7ef) },
        uOpacity: { value: 0.5 },
      },
      vertexShader: [
        'attribute float aSeed;',
        'attribute float aSize;',
        'uniform float uTime;',
        'varying float vAlpha;',
        'varying float vRot;',
        'void main() {',
        '  vec3 p = position;',
        '  float t = mod(uTime * 0.17 + aSeed, 1.0);',
        '  p.y += t * 4.6;',
        '  p.x += sin(t * 4.2 + aSeed * 20.0) * t * 0.95;',
        '  p.z += cos(t * 3.4 + aSeed * 12.0) * t * 0.75;',
        '  vAlpha = (1.0 - t) * 0.55 * smoothstep(0.0, 0.1, t);',
        '  vRot = aSeed * 6.28 + uTime * 0.25;',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  gl_PointSize = aSize * (34.0 + t * 46.0) * (12.0 / -mv.z);',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D uMap;',
        'uniform vec3 uColor;',
        'uniform float uOpacity;',
        'varying float vAlpha;',
        'varying float vRot;',
        'void main() {',
        '  vec2 uv = gl_PointCoord - 0.5;',
        '  float c = cos(vRot), s = sin(vRot);',
        '  uv = mat2(c, -s, s, c) * uv + 0.5;',
        '  vec4 tex = texture2D(uMap, uv);',
        '  gl_FragColor = vec4(uColor, tex.a * vAlpha * uOpacity);',
        '}',
      ].join('\n'),
    });

    var smoke = new T.Points(geo, mat);
    smoke.frustumCulled = false;
    state.smoke = smoke;
    state.scene.add(smoke);
  }

  /* ---------------------------------------------------------------
     POSTPROCESSING: bloom + grade (vignette + grain + chromatic aberration)
     --------------------------------------------------------------- */
  var GradeShader = {
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uVignette: { value: 0.62 },
      uGrain: { value: 0.045 },
      uAberration: { value: 0.0016 },
      uContrast: { value: 1.045 },
      uSaturation: { value: 1.08 },
    },
    vertexShader: [
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D tDiffuse;',
      'uniform float uTime;',
      'uniform float uVignette;',
      'uniform float uGrain;',
      'uniform float uAberration;',
      'uniform float uContrast;',
      'uniform float uSaturation;',
      'varying vec2 vUv;',
      '',
      'float hash(vec2 p) {',
      '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
      '}',
      '',
      'void main() {',
      '  vec2 c = vUv - 0.5;',
      '  float r2 = dot(c, c);',
      '',
      '  // Lệch màu RGB (chromatic aberration) tăng dần về rìa khung',
      '  float ab = uAberration * (0.25 + r2 * 3.2);',
      '  vec2 dir = normalize(c + 1e-6);',
      '  float cr = texture2D(tDiffuse, vUv + dir * ab).r;',
      '  float cg = texture2D(tDiffuse, vUv).g;',
      '  float cb = texture2D(tDiffuse, vUv - dir * ab).b;',
      '  vec3 col = vec3(cr, cg, cb);',
      '',
      '  // Tương phản + bão hoà',
      '  col = (col - 0.5) * uContrast + 0.5;',
      '  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));',
      '  col = mix(vec3(l), col, uSaturation);',
      '',
      '  // Vignette',
      '  float v = smoothstep(0.92, 0.16, r2 * uVignette * 2.2);',
      '  col *= mix(0.62, 1.0, v);',
      '',
      '  // Film grain',
      '  float g = hash(vUv * vec2(1024.0, 768.0) + fract(uTime) * 91.7) - 0.5;',
      '  col += g * uGrain;',
      '',
      '  gl_FragColor = vec4(col, 1.0);',
      '}',
    ].join('\n'),
  };

  function setupComposer(T, w, h) {
    if (
      !T.EffectComposer ||
      !T.RenderPass ||
      !T.UnrealBloomPass ||
      !T.ShaderPass ||
      !T.CopyShader ||
      !T.LuminosityHighPassShader
    ) return;

    try {
      state.composer = new T.EffectComposer(state.renderer);
      state.composer.addPass(new T.RenderPass(state.scene, state.camera));

      state.bloom = new T.UnrealBloomPass(
        new T.Vector2(w, h),
        THEMES.day.bloom,
        0.78,
        THEMES.day.bloomThreshold
      );
      state.composer.addPass(state.bloom);

      if (state.quality === 'high' && !state.reduced) {
        state.grade = new T.ShaderPass(GradeShader);
        state.composer.addPass(state.grade);
      }

      state.composer.setSize(w, h);
      state.composer.setPixelRatio(state.dpr);
    } catch (e) {
      state.composer = null;
      state.bloom = null;
      state.grade = null;
    }
  }

  /* ---------------------------------------------------------------
     THEME NGÀY / ĐÊM
     --------------------------------------------------------------- */
  function applyPreset(preset, immediate) {
    var T = window.THREE;
    if (!T || !state.scene) return;

    state.scene.background.setHex(preset.bg);
    state.scene.fog.color.setHex(preset.fog);
    state.scene.fog.density = preset.fogDensity;

    state.lights.hemi.color.setHex(preset.hemiSky);
    state.lights.hemi.groundColor.setHex(preset.hemiGround);
    state.lights.hemi.intensity = preset.hemiInt;

    state.lights.sun.color.setHex(preset.sun);
    state.lights.sun.intensity = preset.sunInt;
    state.lights.sun.position.set(
      preset.sunPos[0], preset.sunPos[1], preset.sunPos[2]
    );

    state.lights.rim1.intensity = preset.rimInt;
    state.lights.rim2.intensity = preset.rimInt;

    state.renderer.toneMappingExposure = preset.exposure;

    if (state.bloom) {
      state.bloom.strength = preset.bloom;
      state.bloom.threshold = preset.bloomThreshold;
    }

    if (state.groundMat) state.groundMat.color.setHex(preset.ground);
    if (state.soilMat) state.soilMat.color.setHex(preset.soil);
    if (state.pathMat) state.pathMat.color.setHex(preset.path);
    if (state.stepMat) state.stepMat.color.setHex(preset.step);
    if (state.fenceMat) state.fenceMat.color.setHex(preset.fence);

    // Đổi màu vật liệu theo theme (ngày sáng / đêm tối)
    var m = state.mat;
    if (m) {
      if (m.wall) m.wall.color.setHex(preset.wall);
      if (m.wallSide) m.wallSide.color.setHex(preset.wallSide);
      if (m.frame) m.frame.color.setHex(preset.frame);
      if (m.wood) m.wood.color.setHex(preset.wood);
      if (m.leaf) m.leaf.color.setHex(preset.leaf);
      if (m.leafDark) m.leafDark.color.setHex(preset.leafDark);
      if (m.trim) m.trim.color.setHex(preset.frame);
    }
    // Lá cây dùng chung 2 material — tìm qua scene
    state.scene.traverse(function (o) {
      if (o.material && o.material.flatShading && o.material.color) {
        if (o.material.color.getHex() === 0x4ade80) o.material.color.setHex(preset.leaf);
        else if (o.material.color.getHex() === 0x16a34a) o.material.color.setHex(preset.leafDark);
        else if (o.material.color.getHex() === 0x86efac) {
          o.material.color.setHex(state.theme === 'night' ? 0x2f6b4a : 0x86efac);
        }
      }
    });

    state.winEmissive = preset.winEmissive;
    state.lampBase = preset.lampInt;

    if (state.trimStrip) {
      state.trimStrip.material.color.setHex(
        state.theme === 'night' ? 0x67e8f9 : 0x67e8f9
      );
    }

    refreshEnvMap(T, preset);
  }

  House3D.applyTheme = function (theme) {
    var preset = THEMES[theme] ? theme : 'day';
    if (preset === state.theme) return;
    state.theme = preset;
    applyPreset(THEMES[preset], false);
  };

  House3D.getTheme = function () { return state.theme; };

  /* ---------------------------------------------------------------
     TƯƠNG TÁC
     --------------------------------------------------------------- */
  function bindEvents(container) {
    var el = state.renderer.domElement;

    el.addEventListener('pointerdown', function (e) {
      drag.active = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.lastInteract = performance.now();
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', function (e) {
      if (!drag.active) return;
      var dx = e.clientX - drag.x;
      var dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.targetRotY += dx * 0.008;
      drag.targetRotX = clamp(drag.targetRotX + dy * 0.005, -0.5, 0.95);
      drag.velY = dx * 0.008;
      drag.velX = dy * 0.005;
      drag.lastInteract = performance.now();
    });

    function endDrag() {
      if (!drag.active) return;
      drag.active = false;
      drag.targetRotY += drag.velY * 12;
      drag.targetRotX = clamp(drag.targetRotX + drag.velX * 12, -0.5, 0.95);
    }
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('pointerleave', endDrag);

    // Hover cửa sổ → đèn bật
    var raycaster = new window.THREE.Raycaster();
    var mouse = new window.THREE.Vector2();
    var hovered = null;

    el.addEventListener('pointermove', function (e) {
      var rect = el.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, state.camera);
      var hits = raycaster.intersectObjects(state.windows, false);
      var next = hits.length ? hits[0].object : null;
      if (next !== hovered) {
        hovered = next;
        el.style.cursor = hovered ? 'pointer' : 'grab';
      }
    });

    state.setWindowGlow = function (v) {
      var base = state.winEmissive !== undefined ? state.winEmissive : 0.22;
      if (!state.lightsOn) base = 0.02;
      for (var i = 0; i < state.windows.length; i++) {
        var win = state.windows[i];
        var target = win === hovered ? base + 1.8 : base;
        win.material.emissiveIntensity += (target - win.material.emissiveIntensity) * 0.09;
      }
      // Đèn trong phòng sáng theo cửa sổ
      if (state.innerLights) {
        var innerInt = state.theme === 'night' ? 0.85 : 0.3;
        if (!state.lightsOn) innerInt = 0.05;
        state.innerLights[0].intensity = innerInt;
        state.innerLights[1].intensity = innerInt;
      }
    };

    // Resize
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (!state.renderer) return;
        // clientWidth/clientHeight: không bị ảnh hưởng bởi transform của hero
        var w2 = container.clientWidth || container.offsetWidth || 600;
        var h2 = container.clientHeight || container.offsetHeight || 600;
        state.camera.aspect = w2 / h2;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(w2, h2);
        if (state.composer) {
          state.composer.setSize(w2, h2);
          state.composer.setPixelRatio(state.dpr);
        }
      }, 140);
    });

    // Pause khi tab ẩn
    document.addEventListener('visibilitychange', function () {
      state.visible = !document.hidden;
      if (state.visible) start();
      else stop();
    });

    // Pause khi cuộn ra khỏi vùng nhìn
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            state.inView = en.isIntersecting;
          });
        },
        { threshold: 0.01 }
      ).observe(container);
    }
  }

  /* ---------------------------------------------------------------
     VÒNG LẶP RENDER
     --------------------------------------------------------------- */
  function start() {
    if (state.raf) return;
    state.running = true;
    state.clock.start();
    state.raf = requestAnimationFrame(loop);
  }

  function stop() {
    state.running = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
  }

  function loop() {
    if (!state.running) return;
    state.raf = requestAnimationFrame(loop);

    if (state.inView === false) return;

    var dt = Math.min(state.clock.getDelta(), 0.05);
    var t = state.clock.elapsedTime;
    trackFps(dt);

    /* --- Xoay nhà --- */
    if (
      !drag.active &&
      state.spinOn &&
      !state.autoTour &&
      performance.now() - drag.lastInteract > 3000
    ) {
      drag.targetRotY += 0.0022;
    }
    drag.rotY += (drag.targetRotY - drag.rotY) * 0.075;
    drag.rotX += (drag.targetRotX - drag.rotX) * 0.075;

    if (state.group) {
      state.group.rotation.y = drag.rotY;
      state.group.rotation.x = drag.rotX;
      state.group.position.y = Math.sin(t * 0.75) * 0.09;
    }

    /* --- Camera zoom theo scroll --- */
    var zoom = House3D.zoom !== undefined ? House3D.zoom : 1;
    drag.zoom += (zoom - drag.zoom) * 0.08;
    var baseZ = state.camZ !== undefined ? state.camZ : 11.5;
    state.camera.position.z = baseZ * drag.zoom;
    state.camera.position.y = 3.4 + (1 - drag.zoom) * 0.9;
    /* Chỉ cập nhật projection matrix khi FOV thực sự đổi — gọi mỗi frame
       làm camera aspect/projection tính lại vô ích → giảm fps. */
    var nextFov = 42 + (1 - drag.zoom) * 5;
    if (Math.abs(nextFov - state.lastFov) > 0.01) {
      state.lastFov = nextFov;
      state.camera.fov = nextFov;
      state.camera.updateProjectionMatrix();
      state.camera.lookAt(0, 1.7, 0);
    }

    /* --- Mưa --- */
    if (state.rain) state.rain.visible = state.rainOn;
    if (state.rainOn) updateRain(dt);

    /* --- Splash --- */
    if (state.rainOn) updateSplashes(dt);

    /* --- Shader uniforms --- */
    if (state.smoke) state.smoke.material.uniforms.uTime.value = t;
    if (state.grade) state.grade.uniforms.uTime.value = t;
    if (state.rain) {
      state.rain.material.uniforms.uOpacity.value =
        state.theme === 'night' ? 0.4 : 0.55;
    }

    /* --- Cửa sổ phát sáng --- */
    if (state.setWindowGlow) {
      var flicker = state.theme === 'night'
        ? state.winEmissive + Math.sin(t * 0.8) * 0.12
        : state.winEmissive + Math.sin(t * 0.8) * 0.05;
      state.setWindowGlow(flicker);
    }

    /* --- Đèn nhấp nháy --- */
    if (state.lights) {
      var neon = state.theme === 'night' ? 1.35 : 0.45;
      state.lights.pl1.intensity = neon + Math.sin(t * 1.6) * 0.32;
      state.lights.pl2.intensity = neon * 0.78 + Math.cos(t * 1.3) * 0.28;
      state.lights.rim1.intensity =
        (state.theme === 'night' ? 1.5 : 0.15) + Math.sin(t * 1.1) * 0.2;
      state.lights.rim2.intensity =
        (state.theme === 'night' ? 1.5 : 0.15) + Math.cos(t * 0.9) * 0.2;
    }

    /* --- Cảm biến chớp --- */
    if (state.sensor) {
      state.sensor.material.emissiveIntensity = 0.8 + Math.abs(Math.sin(t * 2.4)) * 1.6;
    }

    /* --- Đèn cửa --- */
    if (state.lamp) {
      var lampBase = state.lampBase !== undefined ? state.lampBase : 0.5;
      state.lamp.material.emissiveIntensity = state.lightsOn
        ? lampBase * 1.6 + Math.sin(t * 2.2) * 0.3
        : 0;
    }
    if (state.lampLight) {
      var lb = state.lampBase !== undefined ? state.lampBase : 0.5;
      state.lampLight.intensity = state.lightsOn ? lb + Math.sin(t * 2.2) * 0.12 : 0;
    }

    /* --- Render --- */
    if (state.composer) state.composer.render();
    else state.renderer.render(state.scene, state.camera);
  }

  /* ---------------------------------------------------------------
     TỰ HẠ CHẤT LƯỢNG THEO FPS ĐO ĐƯỢC
     --------------------------------------------------------------- */
  function trackFps(dt) {
    if (dt <= 0) return;
    state.fpsSamples.push(1 / dt);
    if (state.fpsSamples.length > 120) state.fpsSamples.shift();
    if (state.fpsSamples.length < 60) return;

    var sum = 0;
    for (var i = 0; i < state.fpsSamples.length; i++) sum += state.fpsSamples[i];
    var avg = sum / state.fpsSamples.length;

    if (avg < 40 && state.degradeLevel === 0) {
      state.degradeLevel = 1;
      applyDegrade();
    } else if (avg < 25 && state.degradeLevel === 1) {
      state.degradeLevel = 2;
      applyDegrade();
    }
  }

  function applyDegrade() {
    if (!state.renderer) return;
    if (state.degradeLevel >= 1) {
      state.dpr = Math.max(0.85, state.dpr - 0.5);
      state.renderer.setPixelRatio(state.dpr);
      if (state.composer) state.composer.setPixelRatio(state.dpr);
      if (state.grade) {
        state.grade.enabled = false;
      }
    }
    if (state.degradeLevel >= 2) {
      if (state.bloom) state.bloom.enabled = false;
      if (state.renderer.shadowMap.enabled) {
        state.renderer.shadowMap.enabled = false;
        state.scene.traverse(function (o) {
          if (o.isMesh) o.castShadow = false;
        });
      }
    }
    state.fpsSamples.length = 0;
  }

  /* ---------------------------------------------------------------
     CHUYỂN ĐỘNG / ÁNH SÁNG THEO LỆNH
     --------------------------------------------------------------- */
  function setLights(on) {
    state.lightsOn = !!on;
    if (state.lamp) {
      state.lamp.material.emissiveIntensity = state.lightsOn ? 1.6 : 0;
    }
    if (state.lampLight) {
      state.lampLight.intensity = state.lightsOn ? (state.lampBase || 0.5) : 0;
    }
    if (state.trimStrip) {
      state.trimStrip.material.color.setHex(state.lightsOn ? 0x67e8f9 : 0x334155);
    }
    if (state.windows) {
      state.windows.forEach(function (w) {
        w.userData.lit = state.lightsOn;
      });
    }
  }

  function setRain(on) {
    state.rainOn = !!on;
    if (state.rain) state.rain.visible = state.rainOn;
    if (!state.rainOn && state.splashes) {
      state.splashes.forEach(function (s) {
        s.t = 1;
        s.mesh.visible = false;
      });
    }
  }

  function setSensors(on) {
    state.sensorsVisible = !!on;
    if (state.sensorsGroup) state.sensorsGroup.visible = state.sensorsVisible;
  }

  function resetHouse() {
    drag.targetRotX = 0.2;
    drag.targetRotY = -0.45;
    drag.rotX = 0.2;
    drag.rotY = -0.45;
    state.camZ = 11.5;
    House3D.zoom = 1;
    if (state.camera) {
      state.camera.fov = 42;
      state.lastFov = 42;
      state.camera.updateProjectionMatrix();
    }
  }

  /* ---------------------------------------------------------------
     BỘ LỆNH ĐIỀU KHIỂN SCENE (console3d.js gọi vào đây)
     --------------------------------------------------------------- */
  var HELP_LINES = [
    'CÁC LỆNH SẴN CÓ:',
    '  help              — xem danh sách lệnh',
    '  nha | house       — đưa nhà về góc chuẩn, reset camera',
    '  lights on | off   — bật / tắt đèn nhà',
    '  rain on | off     — bật / tắt mưa + vòng nước bắn',
    '  night | day       — đổi preset ánh sáng (đồng bộ giao diện)',
    '  spin on | off     — bật / tắt xoay tự động',
    '  zoom in | out | reset — phóng / thu camera',
    '  sensors on | off  — hiện / ẩn điểm cảm biến trong scene',
    '  clear             — xoá màn hình console',
    '  close             — đóng console',
  ];

  function statusLines() {
    return [
      'Trạng thái hệ thống:',
      '  Đèn: ' + (state.lightsOn ? 'BẬT' : 'TẮT'),
      '  Mưa: ' + (state.rainOn ? 'BẬT' : 'TẮT'),
      '  Cảm biến: ' + (state.sensorsVisible ? 'HIỆN' : 'ẨN'),
      '  Ánh sáng: ' + (state.theme === 'night' ? 'NIGHT' : 'DAY'),
      '  Xoay tự động: ' + (state.spinOn ? 'BẬT' : 'TẮT'),
    ];
  }

  House3D.exec = function (raw) {
    var cmd = String(raw || '').trim().toLowerCase();
    if (!cmd) return { ok: false, lines: [] };

    // Người dùng gõ lệnh đầu tiên → dừng tour tự động
    if (state.autoTour) {
      state.autoTour = false;
      if (state.tourCancel) {
        try { state.tourCancel(); } catch (e) {}
        state.tourCancel = null;
      }
      if (state.tourTimer) {
        window.clearTimeout(state.tourTimer);
        state.tourTimer = null;
      }
    }

    var parts = cmd.split(/\s+/);
    var head = parts[0];
    var arg = parts.slice(1).join(' ').replace(/^-+/, '');

    switch (head) {
      case 'help':
      case '?':
      case 'huongdan':
        return { ok: true, lines: HELP_LINES.slice() };

      case 'nha':
      case 'house':
        if (arg === 'status') return { ok: true, lines: statusLines() };
        resetHouse();
        return { ok: true, lines: ['✔ Đã đưa mô hình nhà về góc chuẩn.'] };

      case 'lights':
      case 'den':
        if (arg === 'on') {
          setLights(true);
          return { ok: true, lines: ['✔ Đèn hành lang & cửa sổ: BẬT'] };
        }
        if (arg === 'off') {
          setLights(false);
          return { ok: true, lines: ['✔ Đèn hành lang & cửa sổ: TẮT'] };
        }
        return {
          ok: false,
          lines: ['✖ Dùng: lights on | lights off'],
        };

      case 'rain':
      case 'mua':
        if (arg === 'on') {
          setRain(true);
          return { ok: true, lines: ['✔ Mưa: BẬT (700 vệt + splash)'] };
        }
        if (arg === 'off') {
          setRain(false);
          return { ok: true, lines: ['✔ Mưa: TẮT'] };
        }
        return { ok: false, lines: ['✖ Dùng: rain on | rain off'] };

      case 'night':
        House3D.applyTheme('night');
        syncPageTheme('dark');
        return { ok: true, lines: ['✔ Chuyển sang chế độ NIGHT (đồng bộ giao diện).'] };

      case 'day':
        House3D.applyTheme('day');
        syncPageTheme('light');
        return { ok: true, lines: ['✔ Chuyển sang chế độ DAY (đồng bộ giao diện).'] };

      case 'spin':
      case 'xoay':
        if (arg === 'on') {
          state.spinOn = true;
          drag.lastInteract = 0;
          return { ok: true, lines: ['✔ Xoay tự động: BẬT'] };
        }
        if (arg === 'off') {
          state.spinOn = false;
          return { ok: true, lines: ['✔ Xoay tự động: TẮT'] };
        }
        return { ok: false, lines: ['✖ Dùng: spin on | spin off'] };

      case 'zoom': {
        var z = House3D.zoom !== undefined ? House3D.zoom : 1;
        if (arg === 'in') {
          House3D.setZoom(z + 0.18);
          return { ok: true, lines: ['✔ Thu camera (zoom in) ' + House3D.zoom.toFixed(2) + '×'] };
        }
        if (arg === 'out') {
          House3D.setZoom(z - 0.18);
          return { ok: true, lines: ['✔ Zoom out ' + House3D.zoom.toFixed(2) + '×'] };
        }
        if (arg === 'reset') {
          House3D.setZoom(1);
          return { ok: true, lines: ['✔ Đã reset zoom (1.00×)'] };
        }
        return { ok: false, lines: ['✖ Dùng: zoom in | zoom out | zoom reset'] };
      }

      case 'sensors':
      case 'cam bien':
        if (arg === 'on') {
          setSensors(true);
          return {
            ok: true,
            lines: ['✔ Điểm cảm biến: HIỆN (ESP32, DHT22, PIR, MQ-2, RELay)'],
          };
        }
        if (arg === 'off') {
          setSensors(false);
          return { ok: true, lines: ['✔ Điểm cảm biến: ẨN'] };
        }
        return { ok: false, lines: ['✖ Dùng: sensors on | sensors off'] };

      case 'status':
      case 'trangthai':
        return { ok: true, lines: statusLines() };

      default:
        return {
          ok: false,
          lines: ['✖ command not found: ' + head, '→ gõ "help" để xem danh sách lệnh'],
        };
    }
  };

  function syncPageTheme(theme) {
    try {
      if (window.Core && window.Core.setTheme) window.Core.setTheme(theme);
      else document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  /* ---------------------------------------------------------------
     CHOREOGRAPHY TỰ ĐỘNG KHI VÀO TRANG
     --------------------------------------------------------------- */
  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function tweenValue(from, to, duration, onUpdate, onDone) {
    var start = performance.now();
    var cancelled = false;

    function frame(now) {
      if (cancelled) return;
      var p = Math.min((now - start) / duration, 1);
      onUpdate(from + (to - from) * easeOutExpo(p), p);
      if (p < 1) window.requestAnimationFrame(frame);
      else if (onDone) onDone();
    }
    window.requestAnimationFrame(frame);

    return function cancel() { cancelled = true; };
  }

  House3D.playIntroTour = function () {
    if (state.reduced) return;
    state.autoTour = true;

    var startRotY = -1.2;
    var endRotY = -0.45;

    drag.rotY = startRotY;
    drag.targetRotY = startRotY;
    state.camZ = 18;
    House3D.zoom = 1;

    var cancelZ = tweenValue(
      18,
      11.5,
      2200,
      function (v) { state.camZ = v; },
      function () { state.camZ = 11.5; }
    );

    var cancelRot = tweenValue(
      startRotY,
      endRotY,
      2600,
      function (v) {
        drag.targetRotY = v;
        drag.rotY = v;
      },
      function () {
        drag.targetRotY = endRotY;
      }
    );

    state.tourCancel = function () {
      cancelZ();
      cancelRot();
    };

    /* Đèn bật theo hiệu ứng domino (mỗi cửa sổ trễ 120ms) */
    var dominoIndex = 0;
    function domino() {
      if (!state.autoTour) return;
      if (dominoIndex >= state.windows.length) return;
      var win = state.windows[dominoIndex];
      win.material.emissiveIntensity = (state.winEmissive || 0.22) + 2.2;
      dominoIndex++;
      state.tourTimer = window.setTimeout(domino, 120);
    }
    state.tourTimer = window.setTimeout(domino, 1200);

    /* Mưa bắt đầu */
    state.tourTimer = window.setTimeout(function () {
      if (!state.autoTour) return;
      setRain(true);
    }, 2000);
  };

  /* ---------------------------------------------------------------
     API
     --------------------------------------------------------------- */
  House3D.setZoom = function (v) {
    House3D.zoom = clamp(v, 0.55, 1.9);
  };

  House3D.destroy = function () {
    stop();
    if (state.tourTimer) window.clearTimeout(state.tourTimer);
    if (state.envRT) state.envRT.dispose();
    if (state.pmrem) state.pmrem.dispose();
    state.textures.forEach(function (t) { t.dispose && t.dispose(); });
    if (state.renderer) {
      state.renderer.dispose();
      if (state.renderer.domElement && state.renderer.domElement.parentNode) {
        state.renderer.domElement.parentNode.removeChild(state.renderer.domElement);
      }
    }
  };
})(window, document);
