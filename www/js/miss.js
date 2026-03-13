'use strict';

/* ---------------------------
   DOM Elemente
   --------------------------- */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const miss = document.getElementById("miss");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const roundNumEl = document.getElementById("roundNum");

/* ---------------------------
   Lives UI
   --------------------------- */
let lives = 3;
function ensureLivesUI() {
  let el = document.getElementById("livesDisplay");
  if (!el) {
    el = document.createElement("div");
    el.id = "livesDisplay";
    el.style.position = "fixed";
    el.style.left = "16px";
    el.style.bottom = "28px";
    el.style.zIndex = 99999;
    el.style.padding = "10px 14px";
    el.style.borderRadius = "10px";
    el.style.background = "rgba(0,0,0,0.65)";
    el.style.color = "#fff";
    el.style.fontFamily = "system-ui, sans-serif";
    el.style.fontSize = "15px";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
  }
  el.textContent = `Leben: ${lives}`;
}
ensureLivesUI();

function updateLivesUI() {
  const el = document.getElementById("livesDisplay");
  if (el) el.textContent = `Leben: ${lives}`;
}

/* ---------------------------
   Helpers
   --------------------------- */
function safeAddListener(el, evt, handler, opts) {
  if (!el || !el.addEventListener) return;
  el.addEventListener(evt, handler, opts);
}
function safeRemoveListener(el, evt, handler, opts) {
  if (!el || !el.removeEventListener) return;
  try { el.removeEventListener(evt, handler, opts); } catch (e) {}
}
function safeGetRect(el) {
  if (!el || !el.getBoundingClientRect) return null;
  try { return el.getBoundingClientRect(); } catch (e) { return null; }
}

/* ---------------------------
   Spielzustand
   --------------------------- */
let width = 0;
let height = 0;
let path = [];
let segsInfo = null;
let round = 1;

let missSize = { w: 80, h: 80 };
let topQuarterY = 0;

let debug = false;
let showSafeZone = debug;

let prestartActive = false;
let playing = false;
let dragging = false;

let currentAlong = 0;
let lastAlong = 0;

let lossInProgress = false;
let freezeInput = false;

let pendingGameOver = false;   // <-- NEU

const START_Y_FACTOR = 0.18;
const TARGET_Y_FACTOR = 0.78;
const PRESTART_THRESHOLD_FACTOR = 0.60;

const PRESTART_EXIT_BUFFER = 8;
const END_THRESHOLD = 6;

/* ---------------------------
   Resize
   --------------------------- */
function resizeGame() {
  if (!canvas) return;
  const w = Math.floor(window.innerWidth);
  const h = Math.floor(window.innerHeight);

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";

  width = w;
  height = h;

  topQuarterY = Math.round(height * PRESTART_THRESHOLD_FACTOR);

  const rect = safeGetRect(miss);
  if (rect) {
    missSize.w = rect.width;
    missSize.h = rect.height;
  }
  draw();
}
window.addEventListener("resize", resizeGame);
resizeGame();

/* ---------------------------
   Spline
   --------------------------- */
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2*p1.x) + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y: 0.5 * ((2*p1.y) + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3)
  };
}

function getSplinePoints(ctrl, samples=12) {
  if (!ctrl || ctrl.length < 2) return ctrl || [];
  const pts = [];
  const pad = [ctrl[0], ...ctrl, ctrl[ctrl.length-1]];
  for (let i=0;i<pad.length-3;i++) {
    const p0=pad[i], p1=pad[i+1], p2=pad[i+2], p3=pad[i+3];
    for (let s=0;s<samples;s++) {
      pts.push(catmullRom(p0,p1,p2,p3, s/samples));
    }
  }
  pts.push(ctrl[ctrl.length-1]);
  return pts;
}

/* ---------------------------
   Pfad
   --------------------------- */
function generatePathForRound(r) {
  const startY = Math.round(height * START_Y_FACTOR);
  const targetY = Math.round(height * TARGET_Y_FACTOR);
  const centerX = Math.round(width / 2);

  const curves = Math.min(10, Math.max(0, r - 1));
  const ctrlCount = Math.max(2, curves * 2 + 2);

  const maxLat = Math.round(width * 0.45);
  const baseAmp = Math.max(40, Math.round(missSize.w * 2));
  const ampFactor = 1 + Math.min(2, r * 0.12);

  const ctrl = [];
  for (let i=0;i<ctrlCount;i++) {
    const t = i/(ctrlCount-1);
    const y = startY + (targetY - startY)*t;

    let lateral = 0;
    if (curves > 0) {
      const amp = Math.min(maxLat, Math.round(baseAmp * ampFactor));
      const phase = t * Math.PI * curves;
      const taper = Math.sin(Math.PI * t);
      lateral = Math.sin(phase) * amp * taper;
      lateral += (Math.random()*2-1) * Math.min(8,r);
    }

    let x = centerX + lateral;
    x = Math.max(missSize.w/2, Math.min(width - missSize.w/2, x));
    ctrl.push({x,y});
  }

  return getSplinePoints(ctrl, Math.min(24, 12 + Math.floor(r/2)));
}

/* ---------------------------
   Segmente
   --------------------------- */
function computeSegments(pts) {
  const segs = [];
  let total = 0;
  for (let i=0;i<pts.length-1;i++) {
    const a=pts[i], b=pts[i+1];
    const dx=b.x-a.x, dy=b.y-a.y;
    const len=Math.sqrt(dx*dx+dy*dy);
    segs.push({a,b,len});
    total+=len;
  }
  return {segs,total};
}

function pointAtDistance(si, d) {
  if (!si || !si.segs.length) return {x:0,y:0};
  if (d<=0) return si.segs[0].a;
  if (d>=si.total) return si.segs[si.segs.length-1].b;

  let acc=0;
  for (let s of si.segs) {
    if (acc + s.len >= d) {
      const t=(d-acc)/s.len;
      return {x:s.a.x+(s.b.x-s.a.x)*t, y:s.a.y+(s.b.y-s.a.y)*t};
    }
    acc+=s.len;
  }
  return si.segs[si.segs.length-1].b;
}

function projectPointOnPath(si, p) {
  let best={dist:Infinity, along:0};
  let acc=0;
  for (let s of si.segs) {
    const ax=s.a.x, ay=s.a.y, bx=s.b.x, by=s.b.y;
    const vx=bx-ax, vy=by-ay;
    const wx=p.x-ax, wy=p.y-ay;
    const len2=vx*vx+vy*vy;
    let t=0;
    if (len2>0) t=(vx*wx+vy*wy)/len2;
    t=Math.max(0,Math.min(1,t));
    const px=ax+vx*t, py=ay+vy*t;
    const dx=p.x-px, dy=p.y-py;
    const d=Math.sqrt(dx*dx+dy*dy);
    const along=acc + s.len*t;
    if (d<best.dist) best={dist:d, along};
    acc+=s.len;
  }
  return best;
}

/* ---------------------------
   Safe‑Zone gekoppelt an debug
   --------------------------- */
function getMaxDeviationPx() {
  return Math.max(24, Math.round(Math.min(missSize.w, missSize.h) * 0.6));
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0,0,width,height);

  if (showSafeZone && path.length>1) {
    ctx.save();
    ctx.lineWidth = getMaxDeviationPx()*2;
    ctx.strokeStyle = "rgba(0,150,255,0.12)";
    ctx.lineJoin="round";
    ctx.lineCap="round";
    ctx.beginPath();
    ctx.moveTo(path[0].x,path[0].y);
    for (let i=1;i<path.length;i++) ctx.lineTo(path[i].x,path[i].y);
    ctx.stroke();

    ctx.lineWidth = getMaxDeviationPx()*0.25;
    ctx.strokeStyle = "rgba(0,150,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(path[0].x,path[0].y);
    for (let i=1;i<path.length;i++) ctx.lineTo(path[i].x,path[i].y);
    ctx.stroke();

    ctx.restore();
  }
}

/* ---------------------------
   Preview
   --------------------------- */
async function animatePreview(points) {
  return new Promise(resolve => {
    if (!points || points.length < 2) return resolve();
    segsInfo = computeSegments(points);
    const total = segsInfo.total;

    const duration = Math.max(1400, total * 0.90);

    const startTime = performance.now();

    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const dist = t * total;
      const p = pointAtDistance(segsInfo, dist);

      miss.style.left = (p.x - missSize.w/2) + "px";
      miss.style.top  = (p.y - missSize.h/2) + "px";

      draw();

      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }

    const startP = points[0];
    miss.style.left = (startP.x - missSize.w/2) + "px";
    miss.style.top  = (startP.y - missSize.h/2) + "px";

    requestAnimationFrame(step);
  });
}

/* ---------------------------
   startCurrentRound
   --------------------------- */
async function startCurrentRound(withPreview = true) {
  path = generatePathForRound(round);
  segsInfo = computeSegments(path);
  currentAlong = 0;
  lastAlong = 0;

  if (withPreview) {
    await animatePreview(path);
  }

  const startP = path[0];
  miss.style.left = (startP.x - missSize.w/2) + "px";
  miss.style.top  = (startP.y - missSize.h/2) + "px";

  enablePrestartMode();
  draw();
}

/* ---------------------------
   Verlust‑Logik
   --------------------------- */
async function triggerLossCheckLoop() {

  if (lives === 0 || overlay.classList.contains("gameOverScreen")) return;
  if (lossInProgress) return;

  lossInProgress = true;
  freezeInput = true;

  overlay.classList.add("redFlash");

  while (true) {
    await new Promise(r => setTimeout(r, 200));

    const rect = safeGetRect(miss);
    if (!rect) continue;

    const midX = rect.left + rect.width / 2;
    const midY = rect.top + rect.height / 2;

    const proj = projectPointOnPath(segsInfo, { x: midX, y: midY });

    if (proj.dist <= getMaxDeviationPx()) {

      lives = Math.max(0, lives - 1);
      updateLivesUI();

      if (lives === 0) {

        pendingGameOver = true;   // <-- NEU

        overlay.classList.remove("redFlash");
        freezeInput = true;
        lossInProgress = false;
        return;
      }

      overlay.classList.remove("redFlash");
      freezeInput = false;
      lossInProgress = false;
      return;
    }
  }
}

/* ---------------------------
   SYNCHRONER GAME OVER FIX
   --------------------------- */
window.addEventListener("pointerup", () => {
  if (pendingGameOver) {
    pendingGameOver = false;
    runGameOver();
  }
});

function runGameOver() {
  const score = Math.max(0, round - 1);

  try {
    if (typeof checkForHighscore === "function" &&
        checkForHighscore(score, "Tico sucht sein Zuhause")) {

      const name = prompt(`Neuer Highscore! Runde ${score}. Dein Name:`);

      if (name && typeof addHighscore === "function") {
        addHighscore(name, score, "Tico sucht sein Zuhause");
      }
    }

    if (typeof showHighscores === "function") {
      showHighscores();
    }
  } catch (e) {
    console.error("Highscore error:", e);
  }

  overlay.innerHTML = `
    <div class="gameOverContainer">
      <div class="gameOverTitle">GAME OVER</div>
      <div class="gameOverScore">Runden: ${score}
  `;
  overlay.classList.add("gameOverScreen");

// Button-Listener sicher setzen, auch wenn pointerup auf dem Button passiert ist
setTimeout(() => {
  const btn = document.getElementById("backToMenuBtn");
  if (btn) {
    btn.onclick = () => {
      window.location.href = "index.html";
    };
  }
}, 0);
}

/* ---------------------------
   Prestart
   --------------------------- */
function enablePrestartMode() {
  prestartActive = true;
  playing = false;
  dragging = false;

  if (miss) miss._preSwitchedToEval = false;

  const startP = path[0];
  miss.style.left = (startP.x - missSize.w / 2) + "px";
  miss.style.top = (startP.y - missSize.h / 2) + "px";

  miss.style.touchAction = "none";
  miss.style.pointerEvents = "auto";

  function onDown(ev) {
    if (freezeInput) return;
    ev.preventDefault();
    dragging = true;
    miss.classList.add("dragging");
    try { miss.setPointerCapture(ev.pointerId); } catch (e) {}
  }

  async function onMove(ev) {
    if (!dragging || freezeInput) return;

    let x = ev.clientX, y = ev.clientY;
    x = Math.max(missSize.w / 2, Math.min(width - missSize.w / 2, x));
    y = Math.max(missSize.h / 2, Math.min(height - missSize.h / 2, y));
    miss.style.left = (x - missSize.w / 2) + "px";
    miss.style.top = (y - missSize.h / 2) + "px";

    const rect = safeGetRect(miss);
    if (!rect) return;
    const midX = rect.left + rect.width / 2;
    const midY = rect.top + rect.height / 2;

    if (midY > topQuarterY - PRESTART_EXIT_BUFFER) {
      const proj = projectPointOnPath(segsInfo, { x: midX, y: midY });

      if (proj.dist > getMaxDeviationPx()) {
        triggerLossCheckLoop();
        return;
      }

      miss._preSwitchedToEval = true;

      safeRemoveListener(miss, "pointerdown", miss._preDown);
      safeRemoveListener(window, "pointermove", miss._preMove);
      safeRemoveListener(window, "pointerup", miss._preUp);

      prestartActive = false;
      startEvaluationMode(proj);

      try { miss.setPointerCapture(ev.pointerId); } catch (e) {}
      if (miss._moveHandler) miss._moveHandler(ev);
    }
  }

  function onUp(ev) {
    if (!dragging) return;
    dragging = false;
    miss.classList.remove("dragging");
    try { miss.releasePointerCapture(ev.pointerId); } catch (e) {}
  }

  miss._preDown = onDown;
  miss._preMove = onMove;
  miss._preUp = onUp;

  safeAddListener(miss, "pointerdown", onDown);
  safeAddListener(window, "pointermove", onMove);
  safeAddListener(window, "pointerup", onUp);

  draw();
}

/* ---------------------------
   Evaluation
   --------------------------- */
function startEvaluationMode(initialProj) {
  playing = true;

  if (initialProj) {
    currentAlong = initialProj.along;
    lastAlong = currentAlong;
    const pos = pointAtDistance(segsInfo, currentAlong);
    miss.style.left = (pos.x - missSize.w / 2) + "px";
    miss.style.top = (pos.y - missSize.h / 2) + "px";
  } else {
    currentAlong = 0;
    lastAlong = 0;
  }

  miss.style.touchAction = "none";
  miss.style.pointerEvents = "auto";

  function onDown(ev) {
    if (freezeInput) return;
    ev.preventDefault();
    dragging = true;
    miss.classList.add("dragging");
    try { miss.setPointerCapture(ev.pointerId); } catch (e) {}
  }

  async function onMove(ev) {
    if (!dragging || freezeInput) return;

    let x = ev.clientX, y = ev.clientY;
    x = Math.max(missSize.w / 2, Math.min(width - missSize.w / 2, x));
    y = Math.max(missSize.h / 2, Math.min(height - missSize.h / 2, y));
    miss.style.left = (x - missSize.w / 2) + "px";
    miss.style.top = (y - missSize.h / 2) + "px";

    const proj = projectPointOnPath(segsInfo, { x, y });

    if (proj.dist > getMaxDeviationPx()) {
      triggerLossCheckLoop();
      return;
    }

    if (proj.along >= lastAlong - 2) {
      currentAlong = proj.along;
      lastAlong = Math.max(lastAlong, currentAlong);
    }

    if (currentAlong >= segsInfo.total - END_THRESHOLD) {
      dragging = false;
      miss.classList.remove("dragging");
      try { miss.releasePointerCapture(ev.pointerId); } catch (e) {}
      onSuccess();
    }
  }

  function onUp(ev) {
    if (!dragging) return;
    dragging = false;
    miss.classList.remove("dragging");
    try { miss.releasePointerCapture(ev.pointerId); } catch (e) {}
  }

  miss._downHandler = onDown;
  miss._moveHandler = onMove;
  miss._upHandler = onUp;

  safeAddListener(miss, "pointerdown", onDown);
  safeAddListener(window, "pointermove", onMove);
  safeAddListener(window, "pointerup", onUp);

  draw();
}

/* ---------------------------
   Erfolg / nächste Runde
   --------------------------- */
function onSuccess() {
  flash("green");
  setTimeout(async () => {
    round++;
    if (roundNumEl) roundNumEl.textContent = round;

    await startCurrentRound(true);
  }, 250);
}

/* ---------------------------
   Flash
   --------------------------- */
function flash(color) {
  if (!overlay) return;
  overlay.classList.add(color === "green" ? "greenFlash" : "redFlash");
  setTimeout(() => overlay.classList.remove("greenFlash", "redFlash"), 300);
}

/* ---------------------------
   Start-Button
   --------------------------- */
if (startBtn) {
  startBtn.addEventListener("click", async () => {
    const rect = safeGetRect(miss);
    if (rect) {
      missSize.w = rect.width;
      missSize.h = rect.height;
    }

    await startCurrentRound(true);
  });
}

/* ---------------------------
   Miss image size initialization
   --------------------------- */
function initMissSizeFromImage() {
  if (!miss) return;
  function setSize() {
    const rect = safeGetRect(miss);
    if (rect) {
      missSize.w = rect.width;
      missSize.h = rect.height;
    }
  }
  if (miss.complete) {
    setSize();
  } else {
    safeAddListener(miss, "load", setSize, { once: true });
    setTimeout(setSize, 500);
  }
}
initMissSizeFromImage();

/* ---------------------------
   Debug: Safe‑Zone Toggle
   --------------------------- */
(function createDebugSafeZoneToggle() {
  if (!debug) return;

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.top = "10px";
  wrapper.style.right = "10px";
  wrapper.style.zIndex = 100000;
  wrapper.style.background = "rgba(0,0,0,0.45)";
  wrapper.style.color = "#fff";
  wrapper.style.padding = "6px 10px";
  wrapper.style.borderRadius = "8px";
  wrapper.style.fontFamily = "system-ui, sans-serif";
  wrapper.style.fontSize = "13px";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "8px";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = showSafeZone;
  cb.id = "safeZoneToggle";
  cb.style.cursor = "pointer";

  const label = document.createElement("label");
  label.htmlFor = "safeZoneToggle";
  label.textContent = "Safe‑Zone anzeigen";
  label.style.cursor = "pointer";

  cb.addEventListener("change", () => {
    showSafeZone = cb.checked;
    draw();
  });

  wrapper.appendChild(cb);
  wrapper.appendChild(label);
  document.body.appendChild(wrapper);
})();

/* ---------------------------
   Highscore Init
   --------------------------- */
try {
  if (typeof Highscore !== "undefined" && Highscore && typeof Highscore.init === "function") {
    Highscore.init({
      title: "Highscores",
      showButton: true,
      buttonText: "Highscores",
      attachTo: document.body
    });
  }
} catch (e) {
  console.warn("Highscore init failed", e);
}

/* ---------------------------
   Initial Setup
   --------------------------- */
(async function initialSetup() {
  path = generatePathForRound(round);
  segsInfo = computeSegments(path);

  const startP = path[0];
  miss.style.left = (startP.x - missSize.w / 2) + "px";
  miss.style.top = (startP.y - missSize.h / 2) + "px";

  updateLivesUI();

  await animatePreview(path);

  enablePrestartMode();
  draw();
})();
// Sicherstellen, dass der Button existiert und klickbar ist
(function(){
  const btn = document.getElementById('menuBtn');
  if (!btn) return;
  // Entferne mögliche Inline-Blocker
  btn.style.pointerEvents = 'auto';
  btn.addEventListener('click', () => {
    window.location.href = 'index.html';
  }, { passive: true });
})();