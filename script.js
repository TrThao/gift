const PASSWORD = "1608";
const DEFAULT_MONTH = 7;
const DEFAULT_DAY = 16;
const RECIPIENT_NAME = "Ánh";
const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isLowPowerDevice =
  prefersReducedMotion ||
  (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
  matchMedia("(max-width: 768px)").matches;
const FX_DENSITY = prefersReducedMotion ? 0.12 : isLowPowerDevice ? 0.3 : 0.55;
const MAX_FX_PARTICLES = isLowPowerDevice ? 420 : 800;

document.documentElement.dataset.performance = isLowPowerDevice ? "lite" : "full";

function scaledFxCount(count, minimum = 1) {
  return Math.max(minimum, Math.round(count * FX_DENSITY));
}

function showGiftSuccess() {
  document.getElementById("successDate").textContent =
    `${pad(targetDate.getDate())} · ${pad(targetDate.getMonth() + 1)}`;
  showScreen("success");
  buildPolaroidRow();
  playSfx("sparkle", { volume: 0.45 });
  vibrate([30, 20, 50]);
}

/* ═══════════════════════════════════════════════════════════════
   V7 — Cinematic engine
   FX canvas (fireflies, petals, sparkles), scene palette,
   ambient audio pad, envelope, typewriter letter, constellation,
   keepsake canvas, vibration, cursor trail.
   ═══════════════════════════════════════════════════════════════ */

const SCENE_MAP = {
  waiting: null,
  unlock: "unlock",
  prelude: "prelude",
  letter: "letter",
  memory: "memory",
  gift: "gift",
  success: "success"
};

function setScene(name) {
  const scene = SCENE_MAP[name];
  if (scene) {
    document.body.setAttribute("data-scene", scene);
  } else {
    document.body.removeAttribute("data-scene");
  }
}

function vibrate(pattern) {
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (_) {}
  }
}

/* ═════════════════ FX canvas (fireflies + petals + sparkles) ═════════════════ */
const fxCanvas = document.getElementById("fxCanvas");
const fxCtx = fxCanvas
  ? fxCanvas.getContext("2d", { alpha: true, desynchronized: true })
  : null;
let fxParticles = [];
let fxRunning = false;
let fxResizeFrame = 0;
const fireflySprites = new Map();

function enqueueFxParticle(particle) {
  if (fxParticles.length >= MAX_FX_PARTICLES) return;
  fxParticles.push(particle);
}

function getFireflySprite(size) {
  const radius = Math.max(3, Math.round(size));
  if (fireflySprites.has(radius)) return fireflySprites.get(radius);

  const sprite = document.createElement("canvas");
  const diameter = radius * 2;
  sprite.width = diameter;
  sprite.height = diameter;
  const ctx = sprite.getContext("2d");
  const glow = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  glow.addColorStop(0, "rgba(255, 230, 170, .95)");
  glow.addColorStop(0.4, "rgba(255, 200, 130, .5)");
  glow.addColorStop(1, "rgba(255, 200, 130, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, diameter, diameter);
  fireflySprites.set(radius, sprite);
  return sprite;
}

function fxResize() {
  if (!fxCanvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, isLowPowerDevice ? 1 : 1.5);
  fxCanvas.width = window.innerWidth * dpr;
  fxCanvas.height = window.innerHeight * dpr;
  fxCanvas.style.width = window.innerWidth + "px";
  fxCanvas.style.height = window.innerHeight + "px";
  if (fxCtx) fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", () => {
  cancelAnimationFrame(fxResizeFrame);
  fxResizeFrame = requestAnimationFrame(fxResize);
}, { passive: true });

function fxLoop() {
  if (!fxCtx) return;
  if (document.hidden) {
    fxRunning = false;
    return;
  }
  if (fxParticles.length > MAX_FX_PARTICLES) {
    fxParticles = fxParticles.slice(-MAX_FX_PARTICLES);
  }
  fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  const now = performance.now();

  let aliveCount = 0;
  for (let i = 0; i < fxParticles.length; i++) {
    const p = fxParticles[i];
    const life = (now - p.born) / p.duration;
    if (life >= 1) continue;

    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity || 0;
    p.vx *= p.drag || 1;
    p.rot = (p.rot || 0) + (p.spin || 0);

    const alpha = p.type === "firefly"
      ? Math.sin(life * Math.PI) * (0.6 + 0.4 * Math.sin(now / 220 + p.phase))
      : p.type === "flower" || p.type === "confetti"
        ? (life < .08 ? life / .08 : life > .72 ? Math.max(0, 1 - (life - .72) / .28) : 1)
      : (life < .15 ? life / .15 : Math.max(0, 1 - (life - .15) / .85));

    fxCtx.save();
    fxCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
    fxCtx.translate(p.x, p.y);

    if (p.type === "firefly") {
      const sprite = getFireflySprite(p.size);
      fxCtx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    } else if (p.type === "petal") {
      fxCtx.rotate(p.rot);
      fxCtx.fillStyle = p.color;
      fxCtx.beginPath();
      fxCtx.ellipse(0, 0, p.size, p.size * .55, 0, 0, Math.PI * 2);
      fxCtx.fill();
      fxCtx.strokeStyle = "rgba(120, 40, 60, .18)";
      fxCtx.stroke();
    } else if (p.type === "sparkle") {
      fxCtx.rotate(p.rot);
      fxCtx.fillStyle = "rgba(255, 240, 200, .95)";
      const s = p.size;
      fxCtx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const a2 = a + Math.PI / 4;
        fxCtx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
        fxCtx.lineTo(Math.cos(a2) * s * .3, Math.sin(a2) * s * .3);
      }
      fxCtx.closePath();
      fxCtx.fill();
    } else if (p.type === "flower") {
      fxCtx.rotate(p.rot);
      drawMiniFlower(fxCtx, p.size, p.color);
    } else if (p.type === "confetti") {
      fxCtx.rotate(p.rot);
      fxCtx.fillStyle = p.color;
      fxCtx.fillRect(-p.size * .45, -p.size * .2, p.size * .9, p.size * .4);
    }
    fxCtx.restore();
    fxParticles[aliveCount++] = p;
  }
  fxParticles.length = aliveCount;

  if (fxParticles.length > 0) {
    requestAnimationFrame(fxLoop);
  } else {
    fxRunning = false;
  }
}

function ensureFxRunning() {
  if (fxRunning) return;
  fxRunning = true;
  requestAnimationFrame(fxLoop);
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && fxParticles.length > 0) ensureFxRunning();
});

function drawMiniFlower(ctx, size, color) {
  const petal = size * .55;
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * petal * .55, Math.sin(a) * petal * .55, petal * .5, petal * .32, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255, 230, 140, .95)";
  ctx.beginPath();
  ctx.arc(0, 0, size * .22, 0, Math.PI * 2);
  ctx.fill();
}

const FLOWER_BURST_COLORS = [
  "#ff8fab", "#ffb3c6", "#ff6b8a", "#ffc2d4", "#e85a7a",
  "#ffd6a0", "#fff0b3", "#f4a4c0", "#ffcad4", "#ffffff"
];

const PETAL_COLORS = [
  "rgba(255, 190, 190, .92)",
  "rgba(245, 170, 170, .88)",
  "rgba(255, 205, 195, .9)",
  "rgba(230, 155, 175, .85)",
  "rgba(255, 220, 195, .82)"
];

function pushFlowerBurstParticle(x, y, speed, now, durationBase = 2800) {
  const angle = Math.random() * Math.PI * 2;
  const sp = speed * (.35 + Math.random() * .85);
  const roll = Math.random();

  if (roll < .42) {
    enqueueFxParticle({
      type: "flower",
      x, y,
      vx: Math.cos(angle) * sp,
      vy: Math.sin(angle) * sp,
      gravity: 0.018 + Math.random() * .012,
      drag: 0.985,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - .5) * .08,
      size: 7 + Math.random() * 9,
      color: FLOWER_BURST_COLORS[Math.floor(Math.random() * FLOWER_BURST_COLORS.length)],
      born: now,
      duration: durationBase + Math.random() * 1400
    });
    return;
  }

  if (roll < .78) {
    enqueueFxParticle({
      type: "petal",
      x, y,
      vx: Math.cos(angle) * sp * 1.1,
      vy: Math.sin(angle) * sp * 1.1,
      gravity: 0.022,
      drag: 0.988,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - .5) * .1,
      size: 8 + Math.random() * 10,
      color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
      born: now,
      duration: durationBase + Math.random() * 1200
    });
    return;
  }

  enqueueFxParticle({
    type: roll < .9 ? "sparkle" : "confetti",
    x, y,
    vx: Math.cos(angle) * sp * 1.25,
    vy: Math.sin(angle) * sp * 1.25,
    gravity: 0.028,
    drag: 0.982,
    rot: Math.random() * Math.PI,
    spin: (Math.random() - .5) * .14,
    size: 3 + Math.random() * 5,
    color: FLOWER_BURST_COLORS[Math.floor(Math.random() * FLOWER_BURST_COLORS.length)],
    born: now,
    duration: 1800 + Math.random() * 1000
  });
}

function spawnGrandFlowerFirework(originX, originY) {
  const cx = originX ?? window.innerWidth / 2;
  const cy = originY ?? window.innerHeight * 0.42;
  const now = performance.now();
  const outerCount = scaledFxCount(200, 30);
  const ringCount = scaledFxCount(140, 22);

  for (let i = 0; i < outerCount; i++) {
    pushFlowerBurstParticle(cx, cy, 8.5 + Math.random() * 5, now, 3400);
  }

  setTimeout(() => {
    const t = performance.now();
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const sp = 6 + Math.random() * 4.5;
      enqueueFxParticle({
        type: "flower",
        x: cx,
        y: cy,
        vx: Math.cos(angle) * sp,
        vy: Math.sin(angle) * sp,
        gravity: 0.014,
        drag: 0.988,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.1,
        size: 10 + Math.random() * 12,
        color: FLOWER_BURST_COLORS[Math.floor(Math.random() * FLOWER_BURST_COLORS.length)],
        born: t,
        duration: 3600 + Math.random() * 1200
      });
    }
    ensureFxRunning();
  }, 70);

  setTimeout(() => {
    spawnSparkleBurst(cx, cy, 55);
    spawnSparkleBurst(cx, cy - 40, 35);
    spawnPetals(50);
  }, 180);

  setTimeout(() => spawnPetals(35), 450);
  ensureFxRunning();
}

function resetGiftFireworkFlash() {
  const flash = document.getElementById("giftFireworkFlash");
  if (flash) flash.classList.remove("is-active");
}

function playGiftFireworkSfx() {
  playSfx("firework", { volume: 0.68 });
  playSfx("sparkle", { volume: 0.44, when: 0.32 });
  playSfx("whoosh", { volume: 0.2, rate: 1.4, when: 0.38 });
}

function flashGiftCinematicVeil() {
  const veil = document.getElementById("giftCinematicVeil");
  if (!veil) return;
  veil.classList.remove("flash");
  void veil.offsetWidth;
  veil.classList.add("flash");
  setTimeout(() => veil.classList.remove("flash"), 220);
}

function spawnClassicFirework(cx, cy) {
  const now = performance.now();
  const colors = ["#ffd700", "#ff6b8a", "#ffb3c6", "#fff8e8", "#ff8fab", "#e8c4ff", "#ffffff"];
  const particleCount = scaledFxCount(130, 22);

  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
    const sp = 4.5 + Math.random() * 6.5;
    enqueueFxParticle({
      type: Math.random() > 0.35 ? "sparkle" : "confetti",
      x: cx,
      y: cy,
      vx: Math.cos(angle) * sp,
      vy: Math.sin(angle) * sp,
      gravity: 0.016,
      drag: 0.984,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.14,
      size: 2.5 + Math.random() * 5.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      born: now,
      duration: 2400 + Math.random() * 1200
    });
  }

  spawnGrandFlowerFirework(cx, cy);
  flashGiftCinematicVeil();
  ensureFxRunning();
}

function runCinematicFireworkShow() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const allBursts = [
    [w * 0.5, h * 0.36, 0],
    [w * 0.26, h * 0.3, 750],
    [w * 0.74, h * 0.32, 1500],
    [w * 0.5, h * 0.24, 2250],
    [w * 0.36, h * 0.4, 3000],
    [w * 0.64, h * 0.38, 3750],
    [w * 0.5, h * 0.34, 4500]
  ];
  const bursts = isLowPowerDevice
    ? allBursts.filter((_, index) => index % 2 === 0)
    : allBursts;

  playGiftFireworkSfx();
  bursts.forEach(([x, y, delay], index) => {
    setTimeout(() => {
      spawnClassicFirework(x, y);
      if (index > 0 && index % 2 === 0) playGiftFireworkSfx();
    }, delay);
  });
}

let giftCinematicRunning = false;
const initializedDrawnScenes = new WeakSet();

/* Đo chiều dài thật của từng nét vẽ để hiệu ứng "vẽ tay" chạy đúng —
   mỗi path/circle sẽ có strokeDasharray = strokeDashoffset = độ dài,
   rồi keyframe sketchDraw đưa dashoffset về 0. */
function initDrawnScene(bqPhase) {
  const scene = bqPhase?.querySelector(".drawn-scene");
  if (!scene || initializedDrawnScenes.has(scene)) return;
  scene.querySelectorAll(".draw-line").forEach(el => {
    if (typeof el.getTotalLength !== "function") return;
    const len = el.getTotalLength();
    if (!Number.isFinite(len) || len <= 0) return;
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
  });
  initializedDrawnScenes.add(scene);
}

function resetGiftCinematic() {
  giftCinematicRunning = false;
  const cinematic = document.getElementById("giftCinematic");
  const fwPhase = document.getElementById("giftFireworkPhase");
  const bqPhase = document.getElementById("giftBouquetPhase");
  const handoff = document.getElementById("giftHandoffPhase");
  const continueBtn = document.getElementById("giftCinematicContinue");
  const veil = document.getElementById("giftCinematicVeil");

  cinematic?.classList.remove("is-active", "phase-fireworks", "phase-bouquet", "phase-handoff", "is-revealing");
  cinematic?.setAttribute("aria-hidden", "true");
  fwPhase?.classList.remove("hidden");
  fwPhase?.setAttribute("aria-hidden", "true");
  bqPhase?.classList.add("hidden");
  bqPhase?.classList.remove("is-playing");
  bqPhase?.setAttribute("aria-hidden", "true");
  handoff?.classList.add("hidden");
  handoff?.classList.remove("is-revealing");
  handoff?.setAttribute("aria-hidden", "true");
  continueBtn?.classList.remove("is-visible");
  veil?.classList.remove("flash");
  fxCanvas?.classList.remove("above");
  resetGiftFireworkFlash();
}

async function playGiftHandoffReveal() {
  const cinematic = document.getElementById("giftCinematic");
  const bqPhase = document.getElementById("giftBouquetPhase");
  const handoff = document.getElementById("giftHandoffPhase");
  const continueBtn = document.getElementById("giftCinematicContinue");

  continueBtn?.classList.remove("is-visible");
  bqPhase?.classList.add("hidden");
  bqPhase?.classList.remove("is-playing");
  bqPhase?.setAttribute("aria-hidden", "true");

  cinematic?.classList.remove("phase-bouquet", "phase-fireworks");
  cinematic?.classList.add("phase-handoff");
  handoff?.classList.remove("hidden");
  handoff?.setAttribute("aria-hidden", "false");

  playSfx("sparkle", { volume: 0.45 });
  spawnPetals(24);
  vibrate([30, 40, 30]);

  await sleep(120);
  cinematic?.classList.add("is-revealing");
  handoff?.classList.add("is-revealing");

  await sleep(3200);

  resetGiftCinematic();
  passcode = "";
  resetPasscodeUI();
  updatePasscode();
  showScreen("unlock");
}

async function playGiftGivingCinematic() {
  if (giftCinematicRunning) return;
  giftCinematicRunning = true;

  const cinematic = document.getElementById("giftCinematic");
  const fwPhase = document.getElementById("giftFireworkPhase");
  const bqPhase = document.getElementById("giftBouquetPhase");
  if (!cinematic || !fwPhase || !bqPhase) {
    giftCinematicRunning = false;
    return;
  }

  resetGiftCinematic();
  giftCinematicRunning = true;

  cinematic.classList.add("is-active", "phase-fireworks");
  cinematic.setAttribute("aria-hidden", "false");
  fwPhase.setAttribute("aria-hidden", "false");
  fxCanvas?.classList.add("above");

  ensureAudio();
  unlockAmbientFromGesture();
  runCinematicFireworkShow();

  await sleep(5400);

  cinematic.classList.remove("phase-fireworks");
  cinematic.classList.add("phase-bouquet");
  fwPhase.classList.add("hidden");
  fwPhase.setAttribute("aria-hidden", "true");
  bqPhase.classList.remove("hidden");
  bqPhase.setAttribute("aria-hidden", "false");

  initDrawnScene(bqPhase);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => bqPhase.classList.add("is-playing"));
  });

  playSfx("sparkle", { volume: 0.42 });
  spawnPetals(28);

  await sleep(16000);
  await sleep(900);

  await playGiftHandoffReveal();
  giftCinematicRunning = false;
}

function spawnFireflies(originX, originY, count = 60) {
  const now = performance.now();
  count = scaledFxCount(count);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.3 + Math.random() * 1.6;
    enqueueFxParticle({
      type: "firefly",
      x: originX + (Math.random() - .5) * 40,
      y: originY + (Math.random() - .5) * 40,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - .3,
      gravity: -0.008,
      drag: 0.995,
      size: 3 + Math.random() * 6,
      phase: Math.random() * Math.PI * 2,
      born: now,
      duration: 3000 + Math.random() * 3000
    });
  }
  ensureFxRunning();
}

function spawnPetals(count = 45) {
  const now = performance.now();
  const w = window.innerWidth;
  count = scaledFxCount(count);
  for (let i = 0; i < count; i++) {
    enqueueFxParticle({
      type: "petal",
      x: Math.random() * w,
      y: -30 - Math.random() * 200,
      vx: (Math.random() - .5) * 1.2,
      vy: 1.2 + Math.random() * 1.8,
      gravity: 0.006,
      drag: 1,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - .5) * 0.06,
      size: 9 + Math.random() * 8,
      color: PETAL_COLORS[i % PETAL_COLORS.length],
      born: now,
      duration: 5500 + Math.random() * 2500
    });
  }
  ensureFxRunning();
}

function spawnSparkleBurst(x, y, count = 20) {
  const now = performance.now();
  count = scaledFxCount(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1.5 + Math.random() * 3;
    enqueueFxParticle({
      type: "sparkle",
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      gravity: 0.03,
      drag: 0.98,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - .5) * .1,
      size: 3 + Math.random() * 4,
      born: now,
      duration: 900 + Math.random() * 500
    });
  }
  ensureFxRunning();
}

/* ═════════════════ Cursor light trail ═════════════════ */
const cursorTrail = document.getElementById("cursorTrail");
let lastTrailAt = 0;
if (cursorTrail && !isLowPowerDevice && matchMedia("(hover: hover)").matches) {
  const trailDots = Array.from({ length: 10 }, () => {
    const dot = document.createElement("span");
    dot.hidden = true;
    cursorTrail.appendChild(dot);
    return dot;
  });
  let trailIndex = 0;

  document.addEventListener("pointermove", e => {
    const now = performance.now();
    if (now - lastTrailAt < 70) return;
    lastTrailAt = now;
    const dot = trailDots[trailIndex];
    trailIndex = (trailIndex + 1) % trailDots.length;
    dot.hidden = false;
    dot.style.left = e.clientX + "px";
    dot.style.top = e.clientY + "px";
    dot.getAnimations().forEach(animation => animation.cancel());
    dot.animate(
      [
        { opacity: 0.8, transform: "translate(-50%, -50%) scale(1)" },
        { opacity: 0, transform: "translate(-50%, -50%) scale(.4)" }
      ],
      { duration: 650, easing: "ease-out" }
    );
  }, { passive: true });
}

/* ═════════════════ Ambient music (file) ═════════════════ */
const AMBIENT_FILE = "music/ambient.mp3"; // Possible Dreams — Eugenio Mininni (Mixkit License)

let ambientAudio = null;
let ambientFadeTimer = null;
let ambientOn = false;
let ambientMuted = false;
let ambientPrimed = false;
let ambientWantsPlay = false;

function fadeAmbientVolume(target, durationMs = 800) {
  if (!ambientAudio) return;
  clearInterval(ambientFadeTimer);
  const start = ambientAudio.volume;
  const delta = target - start;
  if (Math.abs(delta) < 0.001) {
    ambientAudio.volume = target;
    return;
  }
  const steps = Math.max(12, Math.round(durationMs / 40));
  let step = 0;
  ambientFadeTimer = setInterval(() => {
    step += 1;
    ambientAudio.volume = start + (delta * step) / steps;
    if (step >= steps) {
      ambientAudio.volume = target;
      clearInterval(ambientFadeTimer);
      ambientFadeTimer = null;
    }
  }, durationMs / steps);
}

function ensureAmbientAudio() {
  if (ambientAudio) return ambientAudio;
  ambientAudio = new Audio(AMBIENT_FILE);
  ambientAudio.loop = true;
  ambientAudio.preload = "none";
  ambientAudio.playsInline = true;
  ambientAudio.setAttribute("playsinline", "");
  ambientAudio.volume = 0;
  return ambientAudio;
}

function primeAmbientAudio() {
  if (ambientPrimed) return;
  ambientPrimed = true;
  const audio = ensureAmbientAudio();
  if (audio.readyState === 0) audio.load();
}

function markAmbientPlaying() {
  ambientWantsPlay = false;
  ambientOn = true;
  if (ambientAudio) {
    ambientAudio.muted = false;
    fadeAmbientVolume(0.34, 1500);
  }
}

function attemptAmbientPlay() {
  if (!ambientWantsPlay || ambientOn || ambientMuted || !ambientAudio) return;
  ambientAudio.volume = 0;
  ambientAudio.muted = false;
  ambientAudio.play().then(markAmbientPlaying).catch(() => {});
}

function playAmbientFromGesture() {
  if (ambientOn || ambientMuted) return;

  ensureAudio();
  primeAmbientAudio();
  ambientWantsPlay = true;
  attemptAmbientPlay();

  const audio = ambientAudio;
  if (audio && audio.readyState < 2) {
    audio.addEventListener("loadeddata", attemptAmbientPlay, { once: true });
    audio.addEventListener("canplay", attemptAmbientPlay, { once: true });
  }
}

function startAmbient() {
  playAmbientFromGesture();
}

function unlockAmbientFromGesture() {
  if (ambientMuted) return;

  if (!ambientOn) {
    playAmbientFromGesture();
    return;
  }

  const audio = ambientAudio;
  if (!audio) return;

  if (audio.paused || audio.muted) {
    audio.muted = false;
    audio.play()
      .then(() => fadeAmbientVolume(0.34, 600))
      .catch(() => {});
  }
}

function stopAmbient() {
  if (!ambientOn || !ambientAudio) return;
  ambientWantsPlay = false;
  fadeAmbientVolume(0, 600);
  setTimeout(() => {
    ambientAudio.pause();
    ambientAudio.muted = false;
    ambientOn = false;
  }, 650);
}

function setAmbientScene(scene) {
  if (!ambientOn || !ambientAudio) return;
  const volume = {
    unlock: 0.3,
    prelude: 0.32,
    letter: 0.36,
    memory: 0.33,
    gift: 0.35,
    success: 0.38
  };
  fadeAmbientVolume(volume[scene] ?? 0.34, 1800);
}

const audioToggleBtn = document.getElementById("audioToggle");
if (audioToggleBtn) {
  audioToggleBtn.setAttribute("aria-label", "Tắt nhạc nền");

  audioToggleBtn.addEventListener("click", () => {
    ensureAudio();
    if (ambientOn) {
      ambientMuted = true;
      stopAmbient();
      audioToggleBtn.classList.add("is-muted");
      audioToggleBtn.setAttribute("aria-label", "Bật nhạc nền");
    } else {
      ambientMuted = false;
      audioToggleBtn.classList.remove("is-muted");
      audioToggleBtn.setAttribute("aria-label", "Tắt nhạc nền");
      startAmbient();
    }
  });
}

/* —— Soft synthesized SFX via Web Audio —— */
const sfxBuffers = {};
let audioCtx = null;
let letterTypeTimers = [];
let pulseHoldTimer = null;

function getAudioCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function makeBuffer(duration, fillFn) {
  const ctx = getAudioCtx();
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = fillFn(i / ctx.sampleRate, i, ctx.sampleRate);
  return buffer;
}

function buildSynthFallback(name) {
  if (sfxBuffers[name]) return sfxBuffers[name];

  if (name === "ting") sfxBuffers.ting = makeBuffer(0.45, (t) => {
    const e = Math.exp(-t * 5.5);
    return (Math.sin(2 * Math.PI * 2349 * t) * 0.35 +
      Math.sin(2 * Math.PI * 3520 * t) * 0.18 +
      Math.sin(2 * Math.PI * 4698 * t) * 0.08) * e;
  });

  if (name === "click") sfxBuffers.click = makeBuffer(0.1, (t, i) => {
    const n = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 2 - 1;
    return n * Math.exp(-t * 70) * 0.4 +
      Math.sin(2 * Math.PI * 2100 * t) * Math.exp(-t * 45) * 0.35 +
      Math.sin(2 * Math.PI * 4200 * t) * Math.exp(-t * 80) * 0.15;
  });

  if (name === "whoosh") sfxBuffers.whoosh = makeBuffer(0.55, (t, i) => {
    const n = ((Math.sin(i * 78.233) * 43758.5453) % 1) * 2 - 1;
    const amp = Math.sin(Math.PI * t / 0.55) ** 1.1 * 0.5;
    return n * amp;
  });

  if (name === "blow") sfxBuffers.blow = makeBuffer(0.38, (t, i) => {
    const n = ((Math.sin(i * 53.441) * 43758.5453) % 1) * 2 - 1;
    const n2 = ((Math.sin(i * 17.891) * 43758.5453) % 1) * 2 - 1;
    const attack = Math.min(1, t / 0.025);
    const env = attack * Math.exp(-t * 11);
    const breath = (n * 0.55 + n2 * 0.25) * env;
    const puff = t < 0.03 ? Math.sin(2 * Math.PI * 160 * t) * (1 - t / 0.03) * 0.18 * env : 0;
    return breath + puff;
  });

  if (name === "sparkle") sfxBuffers.sparkle = makeBuffer(0.65, (t) => {
    let s = 0;
    const hits = [
      [0, 2637, 0.22], [0.07, 3136, 0.16], [0.14, 3951, 0.18],
      [0.26, 2794, 0.12], [0.34, 4435, 0.14]
    ];
    hits.forEach(([d, f, v]) => {
      const lt = t - d;
      if (lt >= 0 && lt < 0.25) s += Math.sin(2 * Math.PI * f * lt) * Math.exp(-lt * 7) * v;
    });
    return s;
  });

  if (name === "type") sfxBuffers.type = makeBuffer(0.035, (t, i) => {
    const n = ((Math.sin(i * 45.123) * 43758.5453) % 1) * 2 - 1;
    return n * Math.exp(-t * 100) * 0.2;
  });

  if (name === "pulse") sfxBuffers.pulse = makeBuffer(0.65, (t) => {
    const e = t < 0.05 ? t / 0.05 : t > 0.35 ? Math.max(0, (0.65 - t) / 0.3) : 1;
    const bump = t > 0.2 && t < 0.38 ? 1 + 0.35 * Math.sin((t - 0.2) / 0.18 * Math.PI) : 1;
    return (Math.sin(2 * Math.PI * 52 * t) * 0.4 + Math.sin(2 * Math.PI * 78 * t) * 0.18) * e * bump;
  });

  if (name === "firework") sfxBuffers.firework = makeBuffer(1.45, (t, i) => {
    const n = ((Math.sin(i * 91.17) * 43758.5453) % 1) * 2 - 1;
    const rise = t < 0.26 ? n * Math.sin((t / 0.26) * Math.PI) * 0.11 * (1 + t * 2.2) : 0;
    const boomT = t - 0.26;
    let boom = 0;
    if (boomT >= 0 && boomT < 0.55) {
      const env = Math.exp(-boomT * 5.2);
      boom = env * (
        Math.sin(2 * Math.PI * 110 * boomT) * 0.42 +
        Math.sin(2 * Math.PI * 195 * boomT) * 0.24 +
        Math.sin(2 * Math.PI * 320 * boomT) * 0.14 +
        n * 0.18 * Math.exp(-boomT * 11)
      );
    }
    let tail = 0;
    if (t > 0.38) {
      const lt = t - 0.38;
      tail =
        Math.sin(2 * Math.PI * 880 * lt) * Math.exp(-lt * 4.2) * 0.09 +
        Math.sin(2 * Math.PI * 1320 * lt) * Math.exp(-lt * 5.5) * 0.07 +
        Math.sin(2 * Math.PI * 2200 * lt) * Math.exp(-lt * 7) * 0.04;
    }
    return rise + boom + tail;
  });
  return sfxBuffers[name];
}

function ensureAudio() {
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function activateAudioFromFirstInteraction() {
  ensureAudio();
  unlockAmbientFromGesture();
  document.removeEventListener("pointerdown", activateAudioFromFirstInteraction);
  document.removeEventListener("keydown", activateAudioFromFirstInteraction);
}

document.addEventListener("pointerdown", activateAudioFromFirstInteraction, { passive: true });
document.addEventListener("keydown", activateAudioFromFirstInteraction, { passive: true });

function playSfx(name, { volume = 0.55, rate = 1, when = 0 } = {}) {
  try {
    const ctx = ensureAudio();
    let buffer = sfxBuffers[name];
    if (!buffer) {
      buffer = buildSynthFallback(name);
    }
    if (!buffer) return;

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(Math.max(0, ctx.currentTime + when));
  } catch (_) {}
}

function clearLetterTypeSounds() {
  letterTypeTimers.forEach(clearTimeout);
  letterTypeTimers = [];
}

function playLetterTypeSounds() {
  /* Not used anymore — typewriter dispatches ticks per char */
}

/* ═════════════════ Birthday cake + typewriter letter ═════════════════ */
const originalLetterParagraphs = [];
let letterTyping = false;
let letterTypeAbort = false;
let letterEverOpened = false;
let blownCandles = new Set();

function captureLetterHTML() {
  if (originalLetterParagraphs.length) return;
  const letter = document.getElementById("romanticLetter");
  if (!letter) return;
  // Build a fresh content structure — remove existing content
  letter.innerHTML = `
    <span class="paper-glow" aria-hidden="true"></span>
    <span class="corner-flower corner-flower-a" aria-hidden="true">✦</span>
    <span class="corner-flower corner-flower-b" aria-hidden="true">✦</span>
    <div class="letter-content" id="letterContent"></div>
  `;

  originalLetterParagraphs.push(
    { cls: "letter-salutation", text: "Gửi Ánh," },
    { cls: "letter-paragraph", text: "Anh đã nghĩ khá lâu xem nên viết gì cho em trong ngày hôm nay. Một lời chúc bình thường thì có vẻ hơi nhanh, còn một bức thư quá dài lại dễ thành cầu kỳ. Cuối cùng, anh chọn làm trang này để em có thể mở từng phần thật chậm, theo cách riêng của em." },
    { cls: "letter-paragraph", text: "Có lẽ từ lúc nào đó, anh bắt đầu để ý đến những điều rất nhỏ: cách em kể một câu chuyện, lúc em vui, lúc em yên lặng, hay những lần em vô tình khiến không khí xung quanh trở nên nhẹ hơn. Những điều ấy không quá lớn, nhưng đủ để anh nhớ." },
    { cls: "letter-paragraph", text: "Anh chỉ mong khi mở đến đây, em sẽ thấy vui một chút. Không cần phải nghĩ quá nhiều về lý do, cũng không cần phải tìm một câu trả lời nào cả. Cứ xem đây là một điều nhỏ được chuẩn bị riêng cho em là được." },
    { cls: "letter-paragraph", text: "Anh mong những tháng ngày sắp tới của em sẽ có thật nhiều điều dễ thương: những buổi đi chơi vui vẻ, những món ăn ngon, những tin nhắn khiến em bất giác mỉm cười, và những ngày trôi qua nhẹ nhàng hơn một chút." },
    { cls: "letter-paragraph", text: "Còn anh, anh chỉ mong trong một vài khoảnh khắc vui của em sau này, thỉnh thoảng anh cũng có thể được xuất hiện ở đó. Không cần quá nhiều, chỉ cần đủ để em nhớ rằng đã có một người từng dành thời gian chuẩn bị điều này cho em." },
    { cls: "letter-ending", text: "Chúc Ánh có một ngày thật vui.\nVà mong món quà nhỏ này sẽ làm em mỉm cười theo cách thật tự nhiên." },
    { cls: "signature", text: "— Anh" }
  );
}

function resetLetterForEnvelope() {
  captureLetterHTML();
  const stage = document.getElementById("cakeStage");
  const letter = document.getElementById("romanticLetter");
  const caption = document.getElementById("cakeCaption");
  const nextBtn = document.getElementById("continueButton");

  letterTypeAbort = true;
  clearLetterTypeSounds();

  if (letterEverOpened) {
    if (stage) stage.classList.add("is-open");
    if (letter) letter.classList.remove("is-hidden");
    if (nextBtn) nextBtn.disabled = false;
    renderLetterInstant();
    return;
  }

  blownCandles = new Set();
  if (stage) stage.classList.remove("is-open", "wishing");
  if (letter) letter.classList.add("is-hidden");
  document.querySelectorAll(".candle").forEach(c => {
    c.classList.remove("blown");
    c.disabled = false;
  });
  if (caption) caption.textContent = "Thổi tắt từng ngọn nến trước đã nhé";
  if (nextBtn) nextBtn.disabled = true;

  const content = document.getElementById("letterContent");
  if (content) content.innerHTML = "";
}

function renderLetterInstant() {
  const content = document.getElementById("letterContent");
  if (!content) return;
  content.innerHTML = "";
  originalLetterParagraphs.forEach(p => {
    const el = document.createElement("p");
    el.className = p.cls;
    el.textContent = p.text;
    content.appendChild(el);
  });
}

function blowCandle(idx, candleEl) {
  if (!candleEl || candleEl.classList.contains("blown")) return;
  if (blownCandles.has(idx)) return;

  blownCandles.add(idx);
  candleEl.classList.add("blown");
  candleEl.disabled = true;

  // Blow SFX + tiny sparkle at flame
  playSfx("blow", { volume: 0.58, rate: 0.94 + Math.random() * 0.12 });
  vibrate(20);
  const rect = candleEl.getBoundingClientRect();
  spawnSparkleBurst(rect.left + rect.width / 2, rect.top + 8, 6);

  const caption = document.getElementById("cakeCaption");
  const remaining = 4 - blownCandles.size;
  if (caption && remaining > 0) {
    caption.textContent = `Còn ${remaining} ngọn nữa · thổi tiếp đi`;
  }

  if (blownCandles.size >= 4) {
    completeWish();
  }
}

function completeWish() {
  const stage = document.getElementById("cakeStage");
  const letter = document.getElementById("romanticLetter");
  const nextBtn = document.getElementById("continueButton");

  letterEverOpened = true;

  // Wish moment
  stage.classList.add("wishing");
  playSfx("sparkle", { volume: 0.5 });
  vibrate([50, 70, 50]);

  // Sparkle rain at cake center
  const cake = document.getElementById("cake");
  const cr = cake.getBoundingClientRect();
  spawnSparkleBurst(cr.left + cr.width / 2, cr.top + cr.height * .3, 30);
  setTimeout(() => spawnFireflies(cr.left + cr.width / 2, cr.top + cr.height * .3, 40), 300);

  // After wish text shows and cake fades, reveal letter with typewriter
  setTimeout(() => {
    if (stage) stage.classList.add("is-open");
    if (letter) letter.classList.remove("is-hidden");
    typewriteLetter().then(() => {
      if (nextBtn) nextBtn.disabled = false;
    });
  }, 1900);
}

async function typewriteLetter() {
  const content = document.getElementById("letterContent");
  if (!content) return;
  letterTypeAbort = false;
  letterTyping = true;
  content.innerHTML = "";

  const perCharDelay = { salutation: 55, paragraph: 22, ending: 30, signature: 60 };

  for (let pi = 0; pi < originalLetterParagraphs.length; pi++) {
    if (letterTypeAbort) { letterTyping = false; return; }
    const p = originalLetterParagraphs[pi];
    const el = document.createElement("p");
    el.className = p.cls;
    content.appendChild(el);

    const kind = p.cls.includes("salutation") ? "salutation"
              : p.cls.includes("ending") ? "ending"
              : p.cls.includes("signature") ? "signature"
              : "paragraph";
    const delay = perCharDelay[kind];

    const chars = [...p.text];
    const chunkSize = isLowPowerDevice ? 5 : 3;
    for (let ci = 0; ci < chars.length; ci += chunkSize) {
      if (letterTypeAbort) { letterTyping = false; return; }
      const fragment = document.createDocumentFragment();
      const revealBatch = [];
      const end = Math.min(chars.length, ci + chunkSize);

      for (let index = ci; index < end; index++) {
        const ch = chars[index];
        if (ch === "\n") {
          fragment.appendChild(document.createElement("br"));
        } else {
          const span = document.createElement("span");
          span.className = "letter-char" + (ch === " " ? " space" : "");
          span.textContent = ch;
          fragment.appendChild(span);
          revealBatch.push(span);
        }
      }

      el.appendChild(fragment);
      requestAnimationFrame(() => {
        revealBatch.forEach(span => span.classList.add("visible"));
      });
      if (revealBatch.some(span => span.textContent.trim()) && ci % 12 === 0) {
        playSfx("type", { volume: 0.12, rate: 0.9 + Math.random() * 0.2 });
      }
      await sleep((delay + (Math.random() * 12 - 6)) * (end - ci));
    }

    await sleep(kind === "salutation" ? 400 : kind === "paragraph" ? 260 : 500);
  }
  letterTyping = false;
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function startPulseHold() {
  stopPulseHold();
  playSfx("pulse", { volume: 0.5 });
  pulseHoldTimer = setInterval(() => {
    playSfx("pulse", { volume: 0.34 });
  }, 620);
}

function stopPulseHold() {
  if (pulseHoldTimer) {
    clearInterval(pulseHoldTimer);
    pulseHoldTimer = null;
  }
}

const themes = [
  {
    min: 26,
    chapter: "CHƯƠNG 01",
    kicker: "MỘT ĐIỀU ĐANG ĐƯỢC CHUẨN BỊ",
    title: "Chưa cần biết đó là gì.",
    message: "Cứ để ngày tháng đi qua chậm một chút. Có vài điều chỉ đẹp khi xuất hiện đúng lúc.",
    accent: "#aa7767",
    accentSoft: "#d4aa95",
    bg: "#11100f",
    bgSoft: "#1b1917"
  },
  {
    min: 21,
    chapter: "CHƯƠNG 02",
    kicker: "THỜI GIAN VẪN ĐANG LÀM PHẦN VIỆC CỦA NÓ",
    title: "Thêm một ngày được giữ kín.",
    message: "Không phải bí mật nào cũng cần được bật mí sớm. Đôi khi việc chờ đợi chính là một phần của món quà.",
    accent: "#7f7462",
    accentSoft: "#c7bda8",
    bg: "#111310",
    bgSoft: "#24271f"
  },
  {
    min: 16,
    chapter: "CHƯƠNG 03",
    kicker: "MỌI THỨ ĐANG DẦN THÀNH HÌNH",
    title: "Có người đã dành thời gian cho điều này.",
    message: "Không quá ồn ào, không cần phô trương. Chỉ là từng chi tiết nhỏ đang được đặt đúng chỗ.",
    accent: "#817063",
    accentSoft: "#cdb4a0",
    bg: "#151311",
    bgSoft: "#2a211d"
  },
  {
    min: 11,
    chapter: "CHƯƠNG 04",
    kicker: "ĐÃ ĐI QUA HƠN NỬA CHẶNG ĐƯỜNG",
    title: "Điều bất ngờ đang ở gần hơn.",
    message: "Có thể em đã đoán vài lần. Nhưng cứ giữ lại một chút tò mò, phần cuối sẽ thú vị hơn.",
    accent: "#766c79",
    accentSoft: "#c8bbc9",
    bg: "#121116",
    bgSoft: "#26212b"
  },
  {
    min: 7,
    chapter: "CHƯƠNG 05",
    kicker: "BÂY GIỜ CÓ THỂ BẮT ĐẦU MONG CHỜ",
    title: "Khoảng cách chỉ còn tính bằng ngày.",
    message: "Anh sẽ không nói trước đâu. Em chỉ cần nhớ quay lại, đúng ngày và đúng lúc.",
    accent: "#816b6a",
    accentSoft: "#d1aaa7",
    bg: "#151111",
    bgSoft: "#2b2020"
  },
  {
    min: 3,
    chapter: "CHƯƠNG 06",
    kicker: "CÁNH CỬA ĐANG DẦN ĐƯỢC MỞ",
    title: "Chỉ còn vài lần thức dậy.",
    message: "Điều được cất giữ suốt thời gian qua sắp có thể trao tận tay Ánh.",
    accent: "#936e61",
    accentSoft: "#dab29f",
    bg: "#17110f",
    bgSoft: "#30201a"
  },
  {
    min: 1,
    chapter: "CHƯƠNG 07",
    kicker: "NGÀY MAI",
    title: "Chỉ còn một giấc ngủ nữa.",
    message: "Hôm nay em cứ bình thường thôi. Ngày mai hãy quay lại và nhập bốn con số quen thuộc.",
    accent: "#9d7264",
    accentSoft: "#e0b6a4",
    bg: "#17110f",
    bgSoft: "#352019"
  },
  {
    min: 0,
    chapter: "CHƯƠNG CUỐI",
    kicker: "ĐÃ ĐẾN LÚC",
    title: "Điều được chờ đợi đã ở ngay trước cửa.",
    message: "Chỉ thêm một khoảnh khắc. Sau đó, em có thể tự mình mở phần còn lại.",
    accent: "#a77a69",
    accentSoft: "#e5bca7",
    bg: "#17110f",
    bgSoft: "#3a241c"
  }
];

const screens = {
  waiting: document.getElementById("waitingScreen"),
  unlock: document.getElementById("unlockScreen"),
  prelude: document.getElementById("preludeScreen"),
  letter: document.getElementById("letterScreen"),
  memory: document.getElementById("memoryScreen"),
  gift: document.getElementById("giftScreen"),
  success: document.getElementById("successScreen")
};

const currentDateInput = document.getElementById("currentDate");
const birthdayDateInput = document.getElementById("birthdayDate");

let simulatedNow = new Date();
let targetDate = getNextTarget(simulatedNow);
let realMode = true;
let passcode = "";
let timer;
let countdownBaselineMs = null;
let lastThemeDays = null;
let lastDisplayedDate = "";

const COUNTDOWN_RING = 2 * Math.PI * 46;

function formatTargetDate(date) {
  return `${pad(date.getDate())} · ${pad(date.getMonth() + 1)}`;
}

function updateCountdownProgress(diffMs) {
  const ring = document.getElementById("countdownProgress");
  if (!ring || diffMs <= 0) return;

  if (countdownBaselineMs === null || diffMs > countdownBaselineMs) {
    countdownBaselineMs = diffMs;
  }

  const progress = 1 - diffMs / countdownBaselineMs;
  const offset = COUNTDOWN_RING * (1 - Math.min(1, Math.max(0, progress)));
  ring.style.strokeDashoffset = String(offset);
}

function initCountdownRing() {
  const ring = document.getElementById("countdownProgress");
  if (!ring) return;
  ring.style.strokeDasharray = String(COUNTDOWN_RING);
  ring.style.strokeDashoffset = String(COUNTDOWN_RING);
}

function updateCountdownTarget() {
  const label = document.getElementById("countdownTarget");
  if (label) {
    label.textContent = `đến ${formatTargetDate(targetDate)}`;
  }
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function inputDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getNextTarget(from) {
  let target = new Date(from.getFullYear(), DEFAULT_MONTH, DEFAULT_DAY, 0, 0, 0, 0);
  const end = new Date(from.getFullYear(), DEFAULT_MONTH, DEFAULT_DAY, 23, 59, 59, 999);
  if (from > end) {
    target = new Date(from.getFullYear() + 1, DEFAULT_MONTH, DEFAULT_DAY, 0, 0, 0, 0);
  }
  return target;
}


function createLetterSparks() {
  const field = document.getElementById("sparkField");
  if (!field || field.children.length) return;

  const sparkCount = isLowPowerDevice ? 16 : 26;
  for (let i = 0; i < sparkCount; i++) {
    const spark = document.createElement("span");
    spark.className = "letter-spark";
    if (i % 7 === 0) spark.classList.add("large");
    if (i % 9 === 0) spark.classList.add("cross");

    spark.style.left = `${4 + Math.random() * 92}%`;
    spark.style.top = `${4 + Math.random() * 92}%`;
    spark.style.setProperty("--blink", `${1.8 + Math.random() * 3.5}s`);
    spark.style.setProperty("--float", `${7 + Math.random() * 11}s`);
    spark.style.setProperty("--delay", `${-Math.random() * 8}s`);
    field.appendChild(spark);
  }
}

function showScreen(name) {
  if (name !== "letter") {
    letterTypeAbort = true;
    letterTyping = false;
  }
  Object.values(screens).forEach(screen => screen.classList.add("hidden"));
  screens[name].classList.remove("hidden");
  setScene(name);
  setAmbientScene(SCENE_MAP[name]);
  if (name === "letter") {
    createLetterSparks();
    ensureAudio();
    resetLetterForEnvelope();
  } else {
    clearLetterTypeSounds();
  }
  if (name === "gift") {
    resetGiftVisual();
  }
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  requestAnimationFrame(() => window.scrollTo(0, 0));
}

function createMarks() {
  const holder = document.getElementById("floatingMarks");
  holder.innerHTML = "";
  const markCount = isLowPowerDevice ? 8 : 14;
  for (let i = 0; i < markCount; i++) {
    const dot = document.createElement("span");
    dot.style.left = `${Math.random() * 100}%`;
    dot.style.bottom = `${-10 - Math.random() * 80}px`;
    dot.style.animationDuration = `${13 + Math.random() * 16}s`;
    dot.style.animationDelay = `${-Math.random() * 20}s`;
    dot.style.opacity = `${0.08 + Math.random() * 0.2}`;
    holder.appendChild(dot);
  }
}

function applyTheme(days) {
  const theme = themes.find(item => days >= item.min) || themes[themes.length - 1];
  const root = document.documentElement;

  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-soft", theme.accentSoft);
  root.style.setProperty("--bg", theme.bg);
  root.style.setProperty("--bg-soft", theme.bgSoft);

  document.body.style.background =
    `radial-gradient(circle at 80% 12%, ${theme.bgSoft} 0, transparent 35%), ${theme.bg}`;

  document.getElementById("chapterLabel").textContent = theme.chapter;
  document.getElementById("dailyKicker").textContent = theme.kicker;
  animateHeadline(theme.title);
  document.getElementById("dailyMessage").textContent = theme.message;
  updateKineticRail(theme);
}


let lastAnimatedTitle = "";
let preludeTimers = [];
let preludeStarted = false;

function clearPreludeTimers() {
  preludeTimers.forEach(clearTimeout);
  preludeTimers = [];
}

function animateHeadline(text) {
  if (text === lastAnimatedTitle) return;
  lastAnimatedTitle = text;

  const title = document.getElementById("dailyTitle");
  title.innerHTML = text
    .split(" ")
    .map((word, index) => `<span class="reveal-word" style="--delay:${index * 70}ms">${word}</span>`)
    .join(" ");
}

function updateKineticRail(theme) {
  const rail = document.getElementById("kineticRail");
  const phrases = [
    theme.kicker,
    "GIỮ LẠI MỘT CHÚT TÒ MÒ",
    "ĐÚNG NGÀY · ĐÚNG NGƯỜI"
  ];
  rail.innerHTML = [...phrases, ...phrases]
    .map(phrase => `<span>${phrase}</span>`)
    .join("");
}

function dissolveCountdownIntoFireflies() {
  if (preludeStarted) return;
  const timeObj = document.querySelector(".time-object");
  if (!timeObj) { runPrelude(); return; }

  const rect = timeObj.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  playSfx("sparkle", { volume: 0.55 });
  vibrate([30, 40, 30]);
  spawnFireflies(cx, cy, 90);

  timeObj.classList.add("dissolving");
  setTimeout(() => {
    timeObj.classList.remove("dissolving");
    runPrelude();
  }, 1500);
}

function runPrelude() {
  if (preludeStarted) return;
  preludeStarted = true;
  clearInterval(timer);
  clearPreludeTimers();

  showScreen("prelude");
  const lines = [...document.querySelectorAll("#preludeLines p")];
  const holdZone = document.getElementById("holdZone");
  const fragments = document.getElementById("revealFragments");

  holdZone.classList.add("hidden");
  fragments.classList.remove("active");
  lines.forEach(line => line.classList.remove("visible", "dimmed"));

  lines.forEach((line, index) => {
    preludeTimers.push(setTimeout(() => {
      if (index > 0) lines[index - 1].classList.add("dimmed");
      line.classList.add("visible");
    }, 500 + index * 1050));
  });

  preludeTimers.push(
    setTimeout(() => holdZone.classList.remove("hidden"), 500 + lines.length * 1050)
  );
}

let holdTimer = null;
let holdStart = 0;
let holdFrame = null;
const HOLD_DURATION = 1800;

function updateHoldProgress() {
  if (!holdStart) return;
  const elapsed = performance.now() - holdStart;
  const progress = Math.min(elapsed / HOLD_DURATION, 1);
  document.getElementById("holdButton").style.setProperty("--scan-progress", progress);

  if (progress >= 1) {
    completeHold();
    return;
  }

  holdFrame = requestAnimationFrame(updateHoldProgress);
}

function beginHold(event) {
  event.preventDefault();
  if (holdStart) return;

  holdStart = performance.now();
  ensureAudio();
  unlockAmbientFromGesture();
  startPulseHold();
  document.getElementById("holdButton").classList.add("holding");
  document.getElementById("fingerprintStatus").textContent = "Đang mở phần dành cho em...";
  holdFrame = requestAnimationFrame(updateHoldProgress);
}

function cancelHold() {
  if (!holdStart) return;
  holdStart = 0;
  stopPulseHold();
  cancelAnimationFrame(holdFrame);
  document.getElementById("holdButton").classList.remove("holding");
  document.getElementById("holdButton").style.setProperty("--scan-progress", 0);
  document.getElementById("fingerprintStatus").textContent = "Đặt tay lên đây";
}

function completeHold() {
  cancelAnimationFrame(holdFrame);
  holdStart = 0;
  stopPulseHold();

  const button = document.getElementById("holdButton");
  const fragments = document.getElementById("revealFragments");
  button.style.setProperty("--scan-progress", 1);
  button.classList.add("completed");
  document.getElementById("fingerprintStatus").textContent = "Cảm ơn em ✓";
  fragments.classList.add("active");

  vibrate([30, 40, 80]);
  const br = button.getBoundingClientRect();
  spawnSparkleBurst(br.left + br.width / 2, br.top + br.height / 2, 22);
  playSfx("sparkle", { volume: 0.5 });

  setTimeout(() => {
    button.classList.remove("completed", "holding");
    button.style.setProperty("--scan-progress", 0);
    document.getElementById("fingerprintStatus").textContent = "Đặt tay lên đây";
    showScreen("letter");
  }, 1300);
}


function getDailyHint(days){
  if(days > 20) return "Hôm nay vẫn chưa phải lúc. Mai ghé lại nhé.";
  if(days > 14) return "Anh vẫn đang chuẩn bị thêm một chút. Mai xem lại nhé.";
  if(days > 7) return "Mỗi lần em quay lại sẽ có một thay đổi nhỏ.";
  if(days > 3) return "Hình như sắp hoàn thành rồi.";
  if(days > 1) return "Chỉ còn một chút nữa thôi.";
  if(days === 1) return "Mai nhớ ghé lại nhé.";
  return "Hôm nay có vẻ mọi thứ đã sẵn sàng.";
}

function tick() {
  if (document.hidden) return;
  const now = realMode ? new Date() : new Date(simulatedNow);

  if (!realMode) {
    simulatedNow = new Date(simulatedNow.getTime() + 1000);
  }

  const displayDate = `${pad(now.getDate())} · ${pad(now.getMonth() + 1)} · ${now.getFullYear()}`;
  if (displayDate !== lastDisplayedDate) {
    document.getElementById("displayDate").textContent = displayDate;
    lastDisplayedDate = displayDate;
  }

  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    clearInterval(timer);
    dissolveCountdownIntoFireflies();
    return;
  }

  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  document.getElementById("days").textContent = pad(days);
  document.getElementById("hours").textContent = pad(hours);
  document.getElementById("minutes").textContent = pad(minutes);
  document.getElementById("seconds").textContent = pad(seconds);

  updateCountdownProgress(diff);
  if (days !== lastThemeDays) {
    updateCountdownTarget();
    document.getElementById("dateHint").textContent = getDailyHint(days);
    applyTheme(days);
    lastThemeDays = days;
  }
}

function start() {
  clearInterval(timer);
  clearPreludeTimers();
  preludeStarted = false;
  lastAnimatedTitle = "";
  passcode = "";
  giftStep = 0;
  giftUnlocked = false;
  openedStarNodes = new Set();
  letterEverOpened = false;
  letterTypeAbort = true;
  fxParticles = [];
  countdownBaselineMs = null;
  lastThemeDays = null;
  lastDisplayedDate = "";
  fxResize();

  const gift = document.getElementById("giftObject");
  if (gift) gift.className = "luxury-gift";
  const giftScreen = document.getElementById("giftScreen");
  if (giftScreen) giftScreen.classList.add("locked");
  const giftInstruction = document.getElementById("giftInstruction");
  if (giftInstruction) giftInstruction.textContent = "Chiếc hộp vẫn đang khóa. Chạm vào để mở khóa";

  const claim = document.getElementById("claimGiftButton");
  if (claim) {
    claim.disabled = true;
    claim.classList.add("is-disabled");
  }

  const memoryNext = document.getElementById("memoryNextButton");
  if (memoryNext) {
    memoryNext.disabled = true;
    memoryNext.classList.add("is-disabled");
  }

  resetStarGame();
  resetMemoryGiftBridge();
  resetGiftCinematic();
  resetGiftFireworkFlash();

  resetPasscodeUI();
  updatePasscode();
  showScreen("waiting");
  initCountdownRing();
  tick();

  if (!preludeStarted) {
    timer = setInterval(tick, 1000);
  }
}

function resetPasscodeUI() {
  const lock = document.getElementById("locketLock");
  const panel = document.getElementById("locketPanel");
  const pearls = document.getElementById("passcodeDisplay");
  const status = document.getElementById("passcodeStatus");

  lock?.classList.remove("is-open");
  panel?.classList.remove("is-unlocking", "is-error");
  pearls?.classList.remove("is-error");
  document.getElementById("clueCard")?.classList.add("hidden");

  if (status) {
    status.textContent = "Gõ từng số nhé";
    status.classList.remove("error-text", "reward");
  }
}

function updatePasscode() {
  const slots = [...document.querySelectorAll("#passcodeDisplay span")];
  slots.forEach((slot, index) => {
    const filled = index < passcode.length;
    slot.classList.toggle("filled", filled);
    slot.classList.toggle("active-slot", index === passcode.length && passcode.length < 4);
    const digitEl = slot.querySelector(".pearl-digit");
    if (digitEl) digitEl.textContent = filled ? passcode[index] : "";
  });
}

function showPasscodeError() {
  const pearls = document.getElementById("passcodeDisplay");
  const panel = document.getElementById("locketPanel");
  const status = document.getElementById("passcodeStatus");
  const lock = document.getElementById("locketLock");

  lock?.classList.remove("is-open");
  panel?.classList.remove("is-unlocking");
  panel?.classList.remove("is-error");
  pearls?.classList.remove("is-error");
  void panel?.offsetWidth;
  panel?.classList.add("is-error");
  pearls?.classList.add("is-error");

  status.textContent = "Chưa đúng rồi. Thử lại nhé, em.";
  status.classList.add("error-text");
  playSfx("click", { volume: 0.35, rate: 0.7 });
  vibrate([30, 40, 30]);

  setTimeout(() => {
    panel?.classList.remove("is-error");
    pearls?.classList.remove("is-error");
  }, 480);

  passcode = "";
  giftStep = 0;
  giftUnlocked = false;
  openedStarNodes = new Set();

  const gift = document.getElementById("giftObject");
  if (gift) gift.className = "luxury-gift";
  const giftScreen = document.getElementById("giftScreen");
  if (giftScreen) giftScreen.classList.add("locked");
  const giftInstruction = document.getElementById("giftInstruction");
  if (giftInstruction) giftInstruction.textContent = "Chiếc hộp vẫn đang khóa. Chạm vào để mở khóa";

  const claim = document.getElementById("claimGiftButton");
  if (claim) {
    claim.disabled = true;
    claim.classList.add("is-disabled");
  }

  const memoryNext = document.getElementById("memoryNextButton");
  if (memoryNext) {
    memoryNext.disabled = true;
    memoryNext.classList.add("is-disabled");
  }

  resetStarGame();
  updatePasscode();
}

function verifyPasscode() {
  if (passcode !== PASSWORD) {
    showPasscodeError();
    return;
  }

  const status = document.getElementById("passcodeStatus");
  const lock = document.getElementById("locketLock");
  const panel = document.getElementById("locketPanel");

  status.textContent = "Cảm ơn em vì đã nhớ ✦";
  status.classList.remove("error-text");
  status.classList.add("reward");
  giftUnlocked = true;
  ensureAudio();
  playSfx("click", { volume: 0.65 });
  playSfx("sparkle", { volume: 0.4, when: 0.15 });
  vibrate([40, 60, 40]);

  lock?.classList.add("is-open");
  panel?.classList.add("is-unlocking");

  const panelRect = panel?.getBoundingClientRect();
  const cx = panelRect ? panelRect.left + panelRect.width / 2 : window.innerWidth / 2;
  const cy = panelRect ? panelRect.top + panelRect.height * .35 : window.innerHeight * .45;
  spawnSparkleBurst(cx, cy, 32);
  spawnFireflies(cx, cy, 20);

  setTimeout(() => {
    const giftScreen = document.getElementById("giftScreen");
    giftScreen.classList.remove("locked");
    document.getElementById("giftInstruction").textContent = "Khóa đã mở. Chạm lần 1 để tháo nơ";
    showScreen("gift");
    passcode = "";
    updatePasscode();
    resetPasscodeUI();
  }, 1600);
}

document.getElementById("passcodeArea").addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  ensureAudio();
  unlockAmbientFromGesture();

  if (button.dataset.key && passcode.length < 4) {
    passcode += button.dataset.key;
    updatePasscode();
    playSfx("ting", { volume: 0.32, rate: 0.95 + Math.random() * 0.1 });

    const pearls = document.getElementById("passcodeDisplay");
    const active = pearls?.querySelector(`[data-slot="${passcode.length - 1}"]`);
    if (active) {
      const rect = active.getBoundingClientRect();
      spawnSparkleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 5);
    }

    if (passcode.length === 4) {
      setTimeout(verifyPasscode, 280);
    }
  }

  if (button.dataset.action === "clear") {
    passcode = "";
    updatePasscode();
    document.getElementById("passcodeStatus").textContent = "Gõ từng số nhé";
    document.getElementById("passcodeStatus").classList.remove("error-text");
  }

  if (button.dataset.action === "backspace") {
    passcode = passcode.slice(0, -1);
    updatePasscode();
  }
});


document.getElementById("clueButton").addEventListener("click", () => {
  document.getElementById("clueCard").classList.toggle("hidden");
});

const holdButton = document.getElementById("holdButton");
["mousedown", "touchstart", "pointerdown"].forEach(type => {
  holdButton.addEventListener(type, beginHold, { passive: false });
});
["mouseup", "mouseleave", "touchend", "touchcancel", "pointerup", "pointercancel"].forEach(type => {
  holdButton.addEventListener(type, cancelHold);
});



let openedStarNodes = new Set();
let activeTargetStar = null;
let starGameStarted = false;

const starTexts = [
  "Anh thích cách em làm những điều rất bình thường cũng trở nên dễ thương hơn.",
  "Từ lúc bắt đầu làm trang này, anh đã luôn tò mò không biết em sẽ cười thế nào khi mở đến đây.",
  "Có lẽ điều anh thích nhất là việc anh quan tâm đến em một cách rất tự nhiên, chẳng cần phải cố.",
  "Anh mong Ánh sẽ luôn rạng rỡ như chính cái tên của em.",
  "Và anh thật lòng mong đây sẽ không phải lần cuối anh được chuẩn bị một điều gì đó riêng cho em."
];

/* Placed on the heart silhouette so once all found, the drawn heart passes through them:
   bottom point, mid-left, top-left bump, top-right bump, mid-right */
const starPositions = [
  [50, 80],   // bottom point of heart
  [18, 50],   // mid-left curve
  [32, 26],   // top-left bump
  [68, 26],   // top-right bump
  [82, 50]    // mid-right curve
];

const wrongStarHints = [
  "Không phải ngôi sao này đâu...",
  "Anh giấu kỹ hơn một chút.",
  "Nhìn nơi nào sáng lâu hơn nhé.",
  "Gần đúng rồi.",
  "Ngôi sao cần tìm đang gọi em đấy."
];

function createMemoryStars() {
  const field = document.getElementById("memoryStars");
  if (field && !field.children.length) {
    const backgroundStarCount = isLowPowerDevice ? 20 : 32;
    for (let i = 0; i < backgroundStarCount; i++) {
      const star = document.createElement("span");
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.animationDelay = `${-Math.random() * 6}s`;
      star.style.animationDuration = `${2 + Math.random() * 4}s`;
      field.appendChild(star);
    }
  }

  if (!starGameStarted) buildStarGame();
}

function setStarMessage(text) {
  const message = document.getElementById("starMessage");
  message.classList.add("is-changing");
  setTimeout(() => {
    message.textContent = text;
    message.classList.remove("is-changing");
  }, 250);
}

function buildStarGame() {
  const map = document.getElementById("starMap");
  if (!map) return;

  map.innerHTML = "";
  starGameStarted = true;

  const decoyCount = isLowPowerDevice ? 34 : 50;
  for (let i = 0; i < decoyCount; i++) {
    const star = document.createElement("button");
    star.type = "button";
    star.className = "sky-star decoy";
    star.style.left = `${3 + Math.random() * 94}%`;
    star.style.top = `${4 + Math.random() * 91}%`;
    star.style.setProperty("--size", `${1 + Math.random() * 2.4}px`);
    star.style.setProperty("--alpha", `${.18 + Math.random() * .55}`);
    star.style.setProperty("--duration", `${1.8 + Math.random() * 4.8}s`);
    star.style.setProperty("--delay", `${-Math.random() * 6}s`);
    star.setAttribute("aria-label", "Ngôi sao");
    map.appendChild(star);
  }

  spawnNextTarget();
}

function spawnNextTarget() {
  const index = openedStarNodes.size;
  if (index >= starTexts.length) {
    finishStarGame();
    return;
  }

  const map = document.getElementById("starMap");
  const target = document.createElement("button");
  const [x, y] = starPositions[index];
  target.type = "button";
  target.className = "sky-star target";
  target.style.left = `${x}%`;
  target.style.top = `${y}%`;
  target.dataset.index = index;
  target.setAttribute("aria-label", `Ngôi sao đặc biệt số ${index + 1}`);
  map.appendChild(target);
  activeTargetStar = target;
  setStarMessage(
    index === 0
      ? "Có một ngôi sao đang sáng khác thường. Thử tìm nó nhé."
      : `Ngôi sao ${index + 1} / 5 vừa xuất hiện.`
  );
}

function showWrongStarHint(x, y) {
  const map = document.getElementById("starMap");
  const hint = document.createElement("span");
  hint.className = "star-hint-pop";
  hint.style.left = `${x}px`;
  hint.style.top = `${y}px`;
  hint.textContent = wrongStarHints[Math.floor(Math.random() * wrongStarHints.length)];
  map.appendChild(hint);
  setTimeout(() => hint.remove(), 1300);
}

function updateStarProgress() {
  const count = openedStarNodes.size;
  document.querySelectorAll("#starProgress > button").forEach((dot, index) => {
    const opened = openedStarNodes.has(index);
    dot.classList.toggle("done", opened);
    dot.disabled = !opened;
    dot.setAttribute(
      "aria-label",
      opened ? `Đọc lại ngôi sao ${index + 1}` : `Ngôi sao ${index + 1} chưa mở`
    );
  });
  document.getElementById("starCounter").textContent = `${count} / 5`;
}

function finishStarGame() {
  activeTargetStar = null;
  const next = document.getElementById("memoryNextButton");
  next.disabled = false;
  next.classList.remove("is-disabled");
  setStarMessage("Năm câu đã được giữ lại. Em có thể đọc lại bất cứ lúc nào, rồi đi tiếp khi sẵn sàng.");
  drawConstellation();
}

function drawConstellation() {
  const map = document.getElementById("starMap");
  if (!map || map.querySelector(".constellation-svg")) return;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "constellation-svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const d = "M 50 88 C 22 68 6 44 22 24 C 32 12 44 18 50 30 C 56 18 68 12 78 24 C 94 44 78 68 50 88 Z";

  const defs = document.createElementNS(svgNS, "defs");
  defs.innerHTML = `
    <radialGradient id="heart-glow-grad" cx="50%" cy="55%" r="55%">
      <stop offset="0%" stop-color="rgba(255, 160, 180, .55)"/>
      <stop offset="60%" stop-color="rgba(255, 140, 180, .18)"/>
      <stop offset="100%" stop-color="rgba(255, 140, 180, 0)"/>
    </radialGradient>
  `;
  svg.appendChild(defs);

  const pulseGroup = document.createElementNS(svgNS, "g");
  pulseGroup.setAttribute("class", "heart-pulse");

  const glow = document.createElementNS(svgNS, "path");
  glow.setAttribute("class", "heart-glow");
  glow.setAttribute("d", d);
  pulseGroup.appendChild(glow);

  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("class", "heart-line");
  path.setAttribute("d", d);

  const len = path.getTotalLength();
  path.style.strokeDasharray = `${len}`;
  path.style.strokeDashoffset = `${len}`;
  pulseGroup.appendChild(path);
  svg.appendChild(pulseGroup);

  map.appendChild(svg);

  requestAnimationFrame(() => {
    path.getBoundingClientRect();
    requestAnimationFrame(() => {
      path.style.strokeDashoffset = "0";
      svg.classList.add("is-drawn");
      map.classList.add("constellation-done");
    });
  });

  playSfx("sparkle", { volume: 0.5 });
  vibrate([20, 30, 20, 30, 20]);

  setTimeout(() => {
    const rect = svg.getBoundingClientRect();
    spawnSparkleBurst(rect.left + rect.width / 2, rect.top + rect.height * .55, 26);
  }, 2800);
}

let revealIsReread = false;

function previewText(text, max = 72) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

function addStarKeepsake(index) {
  const keepsake = document.getElementById("starKeepsake");
  const list = document.getElementById("starKeepsakeList");
  if (!keepsake || !list || list.querySelector(`[data-star="${index}"]`)) return;

  keepsake.classList.remove("hidden");

  const item = document.createElement("button");
  item.type = "button";
  item.className = "star-keepsake-item";
  item.dataset.star = index;
  item.innerHTML = `
    <small>✦ NGÔI SAO ${String(index + 1).padStart(2, "0")}</small>
    <span>${previewText(starTexts[index])}</span>
  `;
  item.addEventListener("click", () => openStarReveal(index, true));
  list.appendChild(item);
}

function closeStarReveal() {
  const overlay = document.getElementById("starRevealOverlay");
  if (!overlay || overlay.classList.contains("hidden")) return;

  const wasReread = revealIsReread;
  revealIsReread = false;
  overlay.classList.add("hidden");

  if (wasReread) return;

  if (openedStarNodes.size >= starTexts.length) {
    finishStarGame();
    return;
  }

  spawnNextTarget();
}

function openStarReveal(index, isReread = false) {
  const overlay = document.getElementById("starRevealOverlay");
  const label = document.getElementById("starRevealContinueLabel");
  const isLast = index === starTexts.length - 1;
  revealIsReread = isReread;

  document.getElementById("starRevealCount").textContent =
    `NGÔI SAO ${String(index + 1).padStart(2, "0")} · 05`;
  document.getElementById("starRevealText").textContent = starTexts[index];

  if (isReread) {
    label.textContent = "Đóng lại";
  } else if (isLast) {
    label.textContent = "Giữ lại câu cuối";
  } else {
    label.textContent = "Giữ lại câu này";
  }

  if (!isReread) addStarKeepsake(index);
  overlay.classList.remove("hidden");
}

function resetStarGame() {
  openedStarNodes = new Set();
  activeTargetStar = null;
  starGameStarted = false;
  revealIsReread = false;

  const map = document.getElementById("starMap");
  if (map) {
    map.innerHTML = "";
    map.classList.remove("constellation-done");
  }

  document.querySelectorAll("#starProgress > button").forEach(dot => {
    dot.classList.remove("done");
    dot.disabled = true;
  });
  const counter = document.getElementById("starCounter");
  if (counter) counter.textContent = "0 / 5";

  const message = document.getElementById("starMessage");
  if (message) message.textContent = "Có một ngôi sao đang sáng khác thường. Thử tìm nó nhé.";

  const keepsake = document.getElementById("starKeepsake");
  const list = document.getElementById("starKeepsakeList");
  if (keepsake) keepsake.classList.add("hidden");
  if (list) list.innerHTML = "";

  const overlay = document.getElementById("starRevealOverlay");
  if (overlay) overlay.classList.add("hidden");
}

document.getElementById("starRevealContinue").addEventListener("click", closeStarReveal);

document.getElementById("starProgress").addEventListener("click", event => {
  const dot = event.target.closest("button[data-star]");
  if (!dot || dot.disabled) return;
  openStarReveal(Number(dot.dataset.star), true);
});

document.getElementById("starMap").addEventListener("click", event => {
  const map = document.getElementById("starMap");
  const star = event.target.closest(".sky-star");

  if (!star) {
    const rect = map.getBoundingClientRect();
    showWrongStarHint(event.clientX - rect.left, event.clientY - rect.top);
    return;
  }

  if (!star.classList.contains("target")) {
    const rect = map.getBoundingClientRect();
    const starRect = star.getBoundingClientRect();
    showWrongStarHint(
      starRect.left - rect.left + starRect.width / 2,
      starRect.top - rect.top
    );
    return;
  }

  const index = Number(star.dataset.index);
  if (openedStarNodes.has(index)) return;

  openedStarNodes.add(index);
  updateStarProgress();

  const ripple = document.createElement("span");
  ripple.className = "star-ripple";
  ripple.style.left = star.style.left;
  ripple.style.top = star.style.top;
  map.appendChild(ripple);
  setTimeout(() => ripple.remove(), 1250);

  const bounds = star.getBoundingClientRect();
  spawnSparkleBurst(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, 14);
  vibrate(35);

  star.classList.remove("target");
  star.classList.add("found");
  star.remove();
  ensureAudio();
  playSfx("ting", { volume: 0.55, rate: 0.96 + Math.random() * 0.1 });
  openStarReveal(index, false);
});

const BRIDGE_LINE_PAUSES = [1500, 1000, 2000];

function resetMemoryGiftBridge() {
  const overlay = document.getElementById("sceneTransition");
  const lines = document.querySelectorAll("#bridgeLines p");
  if (overlay) {
    overlay.classList.remove("active", "is-bridge");
    overlay.setAttribute("aria-hidden", "true");
  }
  lines.forEach(line => line.classList.remove("is-visible", "is-dimmed"));
}

async function playMemoryGiftBridge() {
  const overlay = document.getElementById("sceneTransition");
  const lines = [...document.querySelectorAll("#bridgeLines p")];
  const nextBtn = document.getElementById("memoryNextButton");

  if (!overlay || !lines.length || overlay.classList.contains("is-bridge")) return;

  if (nextBtn) nextBtn.disabled = true;

  lines.forEach(line => line.classList.remove("is-visible", "is-dimmed"));
  overlay.classList.add("is-bridge");
  overlay.setAttribute("aria-hidden", "false");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add("active"));
  });

  await sleep(900);

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      lines[i - 1].classList.remove("is-visible");
      lines[i - 1].classList.add("is-dimmed");
      await sleep(320);
    }
    lines[i].classList.remove("is-dimmed");
    lines[i].classList.add("is-visible");
    await sleep(BRIDGE_LINE_PAUSES[i]);
  }

  overlay.classList.remove("active");
  await sleep(580);

  resetMemoryGiftBridge();
  await playGiftGivingCinematic();
}

document.getElementById("memoryNextButton").addEventListener("click", () => {
  playMemoryGiftBridge();
});

document.getElementById("continueButton").addEventListener("click", () => {
  showScreen("memory");
  createMemoryStars();
});

const cakeStage = document.getElementById("cakeStage");
if (cakeStage) {
  cakeStage.addEventListener("click", event => {
    const candle = event.target.closest(".candle");
    if (!candle || candle.disabled) return;
    ensureAudio();
    const idx = Number(candle.dataset.candle);
    blowCandle(idx, candle);
  });
}

let giftStep = 0;
let giftUnlocked = false;

function resetGiftVisual() {
  const gift = document.getElementById("giftObject");
  if (!gift) return;
  gift.classList.remove("step-one", "step-two", "step-three");
  if (giftStep < 3) resetGiftFireworkFlash();
  // Re-apply step classes so reload of screen keeps state
  if (giftStep >= 1) gift.classList.add("step-one");
  if (giftStep >= 2) gift.classList.add("step-two");
}

document.getElementById("giftObject").addEventListener("click", () => {
  const gift = document.getElementById("giftObject");
  const giftScreen = document.getElementById("giftScreen");
  const instruction = document.getElementById("giftInstruction");
  const claim = document.getElementById("claimGiftButton");

  if (!giftUnlocked) {
    giftScreen.classList.remove("lock-shake");
    void giftScreen.offsetWidth;
    giftScreen.classList.add("lock-shake");
    instruction.textContent = "Chiếc hộp cần một mật mã trước khi có thể mở";
    setTimeout(() => {
      passcode = "";
      resetPasscodeUI();
      updatePasscode();
      showScreen("unlock");
    }, 650);
    return;
  }

  giftStep += 1;

  if (giftStep === 1) {
    gift.classList.add("step-one");
    playSfx("whoosh", { volume: 0.4 });
    vibrate([25, 40, 25]);
    // Bow flies away — mimic with a couple sparkles at bow positions
    const gr = gift.getBoundingClientRect();
    spawnSparkleBurst(gr.left + gr.width * .35, gr.top + gr.height * .2, 10);
    spawnSparkleBurst(gr.left + gr.width * .65, gr.top + gr.height * .2, 10);
    instruction.textContent = "Nơ đã bay đi. Chạm lần 2 để mở nắp";
    return;
  }

  if (giftStep === 2) {
    gift.classList.add("step-two");
    ensureAudio();
    playSfx("whoosh", { volume: 0.55 });
    playSfx("sparkle", { volume: 0.5, when: 0.12 });
    vibrate([40, 30, 60]);
    spawnPetals(60);
    setTimeout(() => spawnPetals(30), 400);
    instruction.textContent = "Chạm lần cuối để mở quà nhé";
    return;
  }

  giftStep = 3;
  gift.classList.add("step-two", "step-three");
  ensureAudio();
  unlockAmbientFromGesture();
  playSfx("whoosh", { volume: 0.62 });
  playSfx("sparkle", { volume: 0.5, when: 0.15 });
  vibrate([50, 40, 90]);
  spawnPetals(40);
  instruction.textContent = "Món quà đã mở. Chạm để nhận nhé";
  claim.disabled = false;
  claim.classList.remove("is-disabled");
});

document.getElementById("claimGiftButton").addEventListener("click", () => {
  showGiftSuccess();
});

document.getElementById("giftCinematicContinue")?.addEventListener("click", async () => {
  if (giftCinematicRunning) return;
  giftCinematicRunning = true;
  await playGiftHandoffReveal();
  giftCinematicRunning = false;
});

function buildPolaroidRow() {
  const row = document.getElementById("polaroidRow");
  if (!row) return;
  row.innerHTML = "";
  const shortLines = [
    "cách em kể chuyện",
    "lúc em vui rất tự nhiên",
    "khi anh nhớ về em",
    "ánh mắt em rạng rỡ",
    "một điều nhỏ · dành cho em"
  ];
  const marks = ["1", "2", "3", "4", "♥"];
  shortLines.forEach((cap, i) => {
    const p = document.createElement("div");
    p.className = "polaroid";
    p.innerHTML = `
      <div class="polaroid-photo">
        <span class="polaroid-photo-mark">${marks[i]}</span>
      </div>
      <p class="polaroid-caption">${cap}</p>
    `;
    row.appendChild(p);
  });
}

document.getElementById("restartButton").addEventListener("click", () => {
  start();
});

/* ═════════════════ Keepsake canvas ═════════════════ */
const keepsakeSaveBtn = document.getElementById("keepsakeSaveButton");
if (keepsakeSaveBtn) {
  keepsakeSaveBtn.addEventListener("click", downloadKeepsake);
}

function downloadKeepsake() {
  const canvas = document.getElementById("keepsakeCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  // Background — warm gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1c1512");
  bg.addColorStop(0.5, "#2b1f18");
  bg.addColorStop(1, "#12100f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft radial glow top right
  const glow = ctx.createRadialGradient(W * .8, H * .15, 20, W * .8, H * .15, 700);
  glow.addColorStop(0, "rgba(229, 181, 127, .35)");
  glow.addColorStop(1, "rgba(229, 181, 127, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Grain-ish speckles (stars)
  ctx.fillStyle = "rgba(255, 230, 190, .18)";
  for (let i = 0; i < 200; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Header
  ctx.fillStyle = "rgba(239, 217, 176, .68)";
  ctx.font = "500 24px 'DM Sans', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("MỘT KỶ NIỆM NHỎ", W / 2, 100);

  // Title
  ctx.fillStyle = "#f5e6cf";
  ctx.font = "italic 500 82px 'Playfair Display', Georgia, serif";
  ctx.fillText(`Dành cho ${RECIPIENT_NAME}`, W / 2, 220);

  // Date
  const dateStr = `${pad(targetDate.getDate())} · ${pad(targetDate.getMonth() + 1)} · ${targetDate.getFullYear()}`;
  ctx.fillStyle = "rgba(239, 217, 176, .78)";
  ctx.font = "500 32px 'DM Sans', system-ui, sans-serif";
  ctx.fillText(dateStr, W / 2, 288);

  // Divider
  ctx.strokeStyle = "rgba(239, 217, 176, .28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, 340);
  ctx.lineTo(W / 2 + 60, 340);
  ctx.stroke();

  // Section label
  ctx.fillStyle = "rgba(239, 217, 176, .55)";
  ctx.font = "500 22px 'DM Sans', system-ui, sans-serif";
  ctx.fillText("NĂM CÂU ANH GIỮ LẠI", W / 2, 400);

  // Star texts
  ctx.textAlign = "left";
  ctx.fillStyle = "#efe0c6";
  ctx.font = "italic 500 30px 'Playfair Display', Georgia, serif";
  const marginX = 100;
  let y = 470;
  const maxWidth = W - marginX * 2;

  starTexts.forEach((text, i) => {
    ctx.fillStyle = "rgba(229, 181, 127, .82)";
    ctx.font = "600 20px 'DM Sans', system-ui, sans-serif";
    ctx.fillText(`✦  Ngôi sao ${String(i + 1).padStart(2, "0")}`, marginX, y);
    y += 40;
    ctx.fillStyle = "#efe0c6";
    ctx.font = "italic 500 28px 'Playfair Display', Georgia, serif";
    y = wrapText(ctx, text, marginX, y, maxWidth, 42);
    y += 42;
  });

  // Footer handwriting
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(239, 217, 176, .82)";
  ctx.font = "500 44px 'Caveat', cursive";
  ctx.fillText("— Anh", W / 2, H - 90);

  ctx.fillStyle = "rgba(239, 217, 176, .38)";
  ctx.font = "500 16px 'DM Sans', system-ui, sans-serif";
  ctx.fillText("một điều nhỏ · lưu lại", W / 2, H - 44);

  // Trigger download
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ki-niem-${RECIPIENT_NAME.toLowerCase()}-${targetDate.getFullYear()}${pad(targetDate.getMonth() + 1)}${pad(targetDate.getDate())}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }, "image/png", 0.95);

  playSfx("sparkle", { volume: 0.5 });
  vibrate(40);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
  return y;
}

const demoPanel = document.getElementById("demoPanel");

document.getElementById("demoToggle").addEventListener("click", () => {
  demoPanel.classList.add("open");
});

document.getElementById("closeDemo").addEventListener("click", () => {
  demoPanel.classList.remove("open");
});

document.getElementById("applyDate").addEventListener("click", () => {
  const current = new Date(`${currentDateInput.value}T12:00:00`);
  const target = new Date(`${birthdayDateInput.value}T00:00:00`);

  if (Number.isNaN(current.getTime()) || Number.isNaN(target.getTime())) {
    alert("Chọn đủ hai ngày trước nhé.");
    return;
  }

  realMode = false;
  simulatedNow = current;
  targetDate = target;
  demoPanel.classList.remove("open");
  start();
});

document.getElementById("useRealDate").addEventListener("click", () => {
  realMode = true;
  simulatedNow = new Date();
  targetDate = getNextTarget(simulatedNow);
  currentDateInput.value = inputDate(simulatedNow);
  birthdayDateInput.value = inputDate(targetDate);
  demoPanel.classList.remove("open");
  start();
});

// Khởi động với thời gian thật — đếm ngược tới sinh nhật 16/08.
realMode = true;
simulatedNow = new Date();
targetDate = getNextTarget(simulatedNow);
currentDateInput.value = inputDate(simulatedNow);
birthdayDateInput.value = inputDate(targetDate);
createMarks();
start();
