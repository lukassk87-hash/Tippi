/* =========================
   miss.js (komplett)
   - Preview 20% langsamer (PREVIEW_DURATION_MULTIPLIER = 2.4)
   - Bei Lebenverlust: Spiel pausieren, Infotext bestätigen für neuen Versuch
   - Bei aufgebrauchten Leben: Game Over Modal mit Neustart / Hauptmenü
   - Robuste DOM-Guards, Debounced resize, dynamische Abweichung
   ========================= */

'use strict';

/* ---------------------------
   DOM Elemente (können beim Laden noch null sein)
   --------------------------- */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const miss = document.getElementById("miss");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const roundNumEl = document.getElementById("roundNum");

/* ---------------------------
   Modal / UI helpers
   --------------------------- */

let modalCounter = 0;
function createModalElement() {
  const id = `miss-modal-${++modalCounter}`;
  const wrapper = document.createElement('div');
  wrapper.id = id;
  wrapper.style.position = 'fixed';
  wrapper.style.left = '0';
  wrapper.style.top = '0';
  wrapper.style.width = '100%';
  wrapper.style.height = '100%';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'center';
  wrapper.style.zIndex = 100000;
  wrapper.style.pointerEvents = 'auto';
  wrapper.style.background = 'rgba(0,0,0,0.45)';
  return wrapper;
}

/**
 * showInfoModal(message, buttons)
 * - message: string (HTML allowed)
 * - buttons: [{ id: 'ok', label: 'OK', className: 'primary' }, ...]
 * Returns Promise resolving to clicked button id.
 */
function showInfoModal(message, buttons = [{ id: 'ok', label: 'OK' }]) {
  return new Promise(resolve => {
    const wrapper = createModalElement();
    const box = document.createElement('div');
    box.style.minWidth = '280px';
    box.style.maxWidth = '92%';
    box.style.background = '#111';
    box.style.color = '#fff';
    box.style.padding = '18px';
    box.style.borderRadius = '12px';
    box.style.boxShadow = '0 10px 40px rgba(0,0,0,0.6)';
    box.style.textAlign = 'center';
    box.style.pointerEvents = 'auto';
    box.innerHTML = `<div style="margin-bottom:12px; font-size:16px; line-height:1.3;">${message}</div>`;

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.justifyContent = 'center';
    btnRow.style.gap = '10px';
    btnRow.style.marginTop = '6px';

    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.dataset.mid = b.id;
      btn.style.padding = '8px 14px';
      btn.style.borderRadius = '8px';
      btn.style.border = 'none';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '15px';
      btn.style.background = b.className === 'primary' ? '#2ecc71' : '#333';
      btn.style.color = '#fff';
      btn.addEventListener('click', () => {
        try { document.body.removeChild(wrapper); } catch (e) {}
        resolve(b.id);
      });
      btnRow.appendChild(btn);
    });

    box.appendChild(btnRow);
    wrapper.appendChild(box);
    document.body.appendChild(wrapper);
  });
}

/* ---------------------------
   Lives UI element (erstellt, falls nicht vorhanden)
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

/* ---------------------------
   Defensive helper: safe add/remove listeners
   --------------------------- */
function safeAddListener(el, evt, handler, opts) {
  if (!el || typeof el.addEventListener !== 'function') return;
  el.addEventListener(evt, handler, opts);
}
function safeRemoveListener(el, evt, handler, opts) {
  if (!el || typeof el.removeEventListener !== 'function') return;
  try { el.removeEventListener(evt, handler, opts); } catch (e) {}
}

/* ---------------------------
   Safe getBoundingClientRect
   --------------------------- */
function safeGetRect(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return null;
  try { return el.getBoundingClientRect(); } catch (e) { return null; }
}

/* ---------------------------
   Spielzustand / Einstellungen
   --------------------------- */
let width = 0;
let height = 0;
let path = [];
let segsInfo = null;
let round = 1;

const EDGE_MARGIN = 40;
let missSize = { w: 80, h: 80 };
let topQuarterY = 0;
let debug = false;

// Positioning factors
const START_Y_FACTOR = 0.18;
const TARGET_Y_FACTOR = 0.78;
const PRESTART_THRESHOLD_FACTOR = 0.60;

// Preview speed multiplier (20% slower than previous 2.0 -> 2.4)
const PREVIEW_DURATION_MULTIPLIER = 2.4;

// Wegerkennung: dynamisch berechnet
function getMaxDeviationPx() {
  return Math.max(24, Math.round(Math.min(missSize.w, missSize.h) * 0.6));
}

let prestartActive = false;
let playing = false;
let dragging = false;
let currentAlong = 0;
let lastAlong = 0;

const PRESTART_EXIT_BUFFER = 8;
const END_THRESHOLD = 6;

/* ---------------------------
   Resize handler mit Debounce
   --------------------------- */
let resizeTimer = null;
function resizeGame() {
  if (!canvas) return;
  const w = Math.floor(window.innerWidth);
  const h = Math.floor(window.innerHeight);

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';

  width = w;
  height = h;

  topQuarterY = Math.round(height * PRESTART_THRESHOLD_FACTOR);

  const rect = safeGetRect(miss);
  if (rect && rect.width) {
    missSize.w = rect.width;
    missSize.h = rect.height;
  }
  draw();
}
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resizeGame, 120);
});
resizeGame();

/* ---------------------------
   Spline / Geometrie
   --------------------------- */
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const x = 0.5 * ((2 * p1.x) +
    (-p0.x + p2.x) * t +
    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  const y = 0.5 * ((2 * p1.y) +
    (-p0.y + p2.y) * t +
    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  return { x, y };
}

function getSplinePoints(ctrlPoints, samplesPerSeg = 12) {
  if (!ctrlPoints || ctrlPoints.length < 2) return ctrlPoints ? ctrlPoints.slice() : [];
  const pts = [];
  const padded = [ctrlPoints[0], ...ctrlPoints, ctrlPoints[ctrlPoints.length - 1]];
  for (let i = 0; i < padded.length - 3; i++) {
    const p0 = padded[i], p1 = padded[i + 1], p2 = padded[i + 2], p3 = padded[i + 3];
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg;
      pts.push(catmullRom(p0, p1, p2, p3, t));
    }
  }
  pts.push(ctrlPoints[ctrlPoints.length - 1]);
  return pts;
}

/* ---------------------------
   Pfad-Generierung (angepasst)
   --------------------------- */
function generatePathForRound(r) {
  const nominalStartY = Math.max(EDGE_MARGIN, Math.round(height * START_Y_FACTOR));
  const targetY = Math.max(nominalStartY + 50, Math.round(height * TARGET_Y_FACTOR));
  const centerX = Math.round(width / 2);

  const curves = Math.min(10, Math.max(0, r - 1));
  const ctrlCount = Math.max(2, curves * 2 + 2);

  const maxLateralHalf = Math.round(width * 0.45);
  const baseAmp = Math.max(40, Math.round(missSize.w * 2.0));
  const ampFactor = 1.0 + Math.min(2.0, r * 0.12);

  const preferredTop = Math.round(height * START_Y_FACTOR);
  const startY = Math.max(EDGE_MARGIN, Math.min(nominalStartY, preferredTop));

  const ctrl = [];
  for (let i = 0; i < ctrlCount; i++) {
    const t = i / (ctrlCount - 1);
    const y = startY + (targetY - startY) * t;
    let lateral = 0;
    if (curves > 0) {
      const amp = Math.min(maxLateralHalf, Math.round(baseAmp * ampFactor));
      const phase = (i / (ctrlCount - 1)) * Math.PI * curves;
      const taper = Math.sin(Math.PI * t);
      lateral = Math.sin(phase) * amp * taper;
      const jitter = (Math.random() * 2 - 1) * Math.min(8, r);
      lateral += jitter;
    }
    let x = centerX + lateral;
    x = Math.max(Math.round(missSize.w / 2), Math.min(width - Math.round(missSize.w / 2), x));
    ctrl.push({ x, y });
  }

  return getSplinePoints(ctrl, Math.min(24, 12 + Math.floor(r / 2)));
}

/* ---------------------------
   Segment-Helpers
   --------------------------- */
function computeSegments(points) {
  const segs = [];
  let total = 0;
  if (!points || points.length < 2) return { segs, total };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segs.push({ a, b, len });
    total += len;
  }
  return { segs, total };
}

function pointAtDistance(si, d) {
  if (!si || !si.segs || si.segs.length === 0) return { x: 0, y: 0 };
  const { segs, total } = si;
  if (d <= 0) return segs[0].a;
  if (d >= total) return segs[segs.length - 1].b;
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (acc + s.len >= d) {
      const t = (d - acc) / s.len;
      return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
    }
    acc += s.len;
  }
  return segs[segs.length - 1].b;
}

function projectPointOnPath(si, p) {
  const best = { dist: Infinity, along: 0, point: null };
  if (!si || !si.segs || si.segs.length === 0) return best;
  const { segs } = si;
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const ax = s.a.x, ay = s.a.y, bx = s.b.x, by = s.b.y;
    const vx = bx - ax, vy = by - ay;
    const wx = p.x - ax, wy = p.y - ay;
    const len2 = vx * vx + vy * vy;
    let t = 0;
    if (len2 > 0) t = (vx * wx + vy * wy) / len2;
    t = Math.max(0, Math.min(1, t));
    const projX = ax + vx * t, projY = ay + vy * t;
    const dx = p.x - projX, dy = p.y - projY;
    const d = Math.sqrt(dx * dx + dy * dy);
    const along = acc + s.len * t;
    if (d < best.dist) best.dist = d, best.along = along, best.point = { x: projX, y: projY };
    acc += s.len;
  }
  return best;
}

/* ---------------------------
   Preview Animation (slower)
   --------------------------- */
function animatePreview(points) {
  return new Promise(resolve => {
    if (!points || points.length < 2) return resolve();
    segsInfo = computeSegments(points);
    const total = segsInfo.total;

    const base = Math.max(700, Math.min(2200, total * 0.45));
    const duration = base * PREVIEW_DURATION_MULTIPLIER; // slower by multiplier

    const startTime = performance.now();

    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const dist = t * total;
      const p = pointAtDistance(segsInfo, dist);
      if (miss) {
        miss.style.left = (p.x - missSize.w / 2) + "px";
        miss.style.top = (p.y - missSize.h / 2) + "px";
      }
      draw();
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        currentAlong = 0;
        lastAlong = 0;
        resolve();
      }
    }

    const startP = points[0];
    if (miss) {
      miss.style.left = (startP.x - missSize.w / 2) + "px";
      miss.style.top = (startP.y - missSize.h / 2) + "px";
    }
    requestAnimationFrame(step);
  });
}

/* ---------------------------
   Draw (Canvas remains mostly empty)
   --------------------------- */
function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  if (debug && path && path.length > 1) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
    ctx.restore();
  }
}

/* ---------------------------
   Leben / Verlustbehandlung (mit Modal-Pause)
   --------------------------- */

function updateLivesUI() {
  const el = document.getElementById("livesDisplay");
  if (el) el.textContent = `Leben: ${lives}`;
}

async function handleLoss() {
  // Flash and short pause
  flash("red");
  await new Promise(res => setTimeout(res, 250));

  // Decrement lives
  lives = Math.max(0, lives - 1);
  updateLivesUI();

  // Pause game: remove interaction handlers and mark not playing
  pauseInteraction();

  if (lives > 0) {
    // Show modal informing player and wait for confirmation to retry
    const choice = await showInfoModal(
      `Du hast ein Leben verloren. Noch verbleibende Leben: <strong>${lives}</strong>.<br>Bereit für einen neuen Versuch?`,
      [{ id: 'retry', label: 'Neuer Versuch', className: 'primary' }]
    );

    if (choice === 'retry') {
      // restart same round: regenerate path, preview, prestart
      path = generatePathForRound(round);
      segsInfo = computeSegments(path);
      currentAlong = 0;
      lastAlong = 0;
      await animatePreview(path);
      if (path && path.length > 0 && miss) {
        const startP = path[0];
        miss.style.left = (startP.x - missSize.w / 2) + "px";
        miss.style.top = (startP.y - missSize.h / 2) + "px";
      }
      draw();
      enablePrestartMode();
      return;
    } else {
      // fallback: re-enable prestart
      enablePrestartMode();
      return;
    }
  }

  // lives == 0 -> Game Over
  try {
    if (typeof Highscore !== 'undefined' && Highscore && typeof Highscore.recordEndOfGame === 'function') {
      Highscore.recordEndOfGame(round);
    }
  } catch (e) {
    console.warn("Highscore.recordEndOfGame failed", e);
  }

  // Show Game Over modal with options
  const goChoice = await showInfoModal(
    `<strong>Game Over</strong><br>Du hast alle Leben verloren.<br>Erreichte Runde: <strong>${round}</strong>`,
    [
      { id: 'restart', label: 'Neustart', className: 'primary' },
      { id: 'menu', label: 'Hauptmenü', className: 'secondary' }
    ]
  );

  if (goChoice === 'restart') {
    // Reset game state and start from round 1
    round = 1;
    lives = 3;
    updateLivesUI();
    if (roundNumEl) roundNumEl.textContent = round;

    path = generatePathForRound(round);
    segsInfo = computeSegments(path);
    currentAlong = 0;
    lastAlong = 0;
    await animatePreview(path);
    if (path && path.length > 0 && miss) {
      const startP = path[0];
      miss.style.left = (startP.x - missSize.w / 2) + "px";
      miss.style.top = (startP.y - missSize.h / 2) + "px";
    }
    draw();
    enablePrestartMode();
    return;
  }

  if (goChoice === 'menu') {
    // Navigate back to main menu
    try { window.location.href = 'index.html'; } catch (e) {}
    return;
  }

  // default fallback
  enablePrestartMode();
}

/* ---------------------------
   Pause / Resume Interaction Helpers
   --------------------------- */

function pauseInteraction() {
  prestartActive = false;
  playing = false;
  dragging = false;

  // Remove any pointer handlers safely
  safeRemoveListener(miss, "pointerdown", miss._preDown);
  safeRemoveListener(window, "pointermove", miss._preMove);
  safeRemoveListener(window, "pointerup", miss._preUp);

  safeRemoveListener(miss, "pointerdown", miss._downHandler);
  safeRemoveListener(window, "pointermove", miss._moveHandler);
  safeRemoveListener(window, "pointerup", miss._upHandler);

  if (miss) miss.classList.remove("dragging");
}

function resumeInteractionAfterModal() {
  // This function intentionally left minimal: caller should decide whether to
  // re-enable prestart or evaluation mode depending on game state.
  // Typically we call enablePrestartMode() after modal confirmation.
}

/* ---------------------------
   Prestart
   --------------------------- */

function enablePrestartMode() {
  prestartActive = true;
  playing = false;
  dragging = false;

  if (path && path.length > 0 && miss) {
    const startP = path[0];
    miss.style.left = (startP.x - missSize.w / 2) + "px";
    miss.style.top = (startP.y - missSize.h / 2) + "px";
  } else if (miss) {
    const sx = Math.round(width / 2);
    const sy = Math.round(height * START_Y_FACTOR);
    miss.style.left = (sx - missSize.w / 2) + "px";
    miss.style.top = (sy - missSize.h / 2) + "px";
  }

  if (miss) {
    miss.style.touchAction = "none";
    miss.style.pointerEvents = "auto";
  }

  function onDown(ev) {
    ev.preventDefault();
    dragging = true;
    if (miss) miss.classList.add("dragging");
    try { if (miss && ev.pointerId != null) miss.setPointerCapture(ev.pointerId); } catch (e) {}
  }

  function onMove(ev) {
    if (!dragging || !miss) return;
    let x = ev.clientX;
    let y = ev.clientY;
    x = Math.max(missSize.w / 2, Math.min(width - missSize.w / 2, x));
    y = Math.max(missSize.h / 2, Math.min(height - missSize.h / 2, y));
    miss.style.left = (x - missSize.w / 2) + "px";
    miss.style.top = (y - missSize.h / 2) + "px";
  }

  async function onUp(ev) {
    if (!dragging || !miss) return;
    dragging = false;
    miss.classList.remove("dragging");
    try { if (ev.pointerId != null) miss.releasePointerCapture(ev.pointerId); } catch (e) {}

    const rect = safeGetRect(miss);
    if (!rect) return;
    const midY = rect.top + rect.height / 2;
    const midX = rect.left + rect.width / 2;

    if (midY > topQuarterY - PRESTART_EXIT_BUFFER) {
      if (!path || path.length < 2) return;
      segsInfo = computeSegments(path);
      const proj = projectPointOnPath(segsInfo, { x: midX, y: midY });

      if (proj.dist > getMaxDeviationPx()) {
        await handleLoss();
        return;
      }

      prestartActive = false;
      startEvaluationMode(proj);
      return;
    }
  }

  safeRemoveListener(miss, "pointerdown", miss._preDown);
  safeRemoveListener(window, "pointermove", miss._preMove);
  safeRemoveListener(window, "pointerup", miss._preUp);

  miss._preDown = onDown;
  miss._preMove = onMove;
  miss._preUp = onUp;

  safeAddListener(miss, "pointerdown", miss._preDown);
  safeAddListener(window, "pointermove", miss._preMove);
  safeAddListener(window, "pointerup", miss._preUp);

  draw();
}

/* ---------------------------
   Evaluation (mit Wegerkennung)
   --------------------------- */

function startEvaluationMode(initialProj) {
  if (!path || path.length < 2) return;
  playing = true;
  segsInfo = computeSegments(path);

  if (initialProj && typeof initialProj.along === "number") {
    currentAlong = Math.max(0, Math.min(segsInfo.total, initialProj.along));
    lastAlong = currentAlong;
    const pos = pointAtDistance(segsInfo, currentAlong);
    if (miss) {
      miss.style.left = (pos.x - missSize.w / 2) + "px";
      miss.style.top = (pos.y - missSize.h / 2) + "px";
    }
  } else {
    currentAlong = 0;
    lastAlong = 0;
    const startP = pointAtDistance(segsInfo, 0);
    if (miss) {
      miss.style.left = (startP.x - missSize.w / 2) + "px";
      miss.style.top = (startP.y - missSize.h / 2) + "px";
    }
  }

  if (miss) {
    miss.style.touchAction = "none";
    miss.style.pointerEvents = "auto";
  }

  function onDown(ev) {
    ev.preventDefault();
    dragging = true;
    if (miss) miss.classList.add("dragging");
    try { if (miss && ev.pointerId != null) miss.setPointerCapture(ev.pointerId); } catch (e) {}
  }

  async function onMove(ev) {
    if (!dragging || !miss) return;
    let x = ev.clientX;
    let y = ev.clientY;
    x = Math.max(missSize.w / 2, Math.min(width - missSize.w / 2, x));
    y = Math.max(missSize.h / 2, Math.min(height - missSize.h / 2, y));
    miss.style.left = (x - missSize.w / 2) + "px";
    miss.style.top = (y - missSize.h / 2) + "px";

    const proj = projectPointOnPath(segsInfo, { x, y });

    if (proj.dist > getMaxDeviationPx()) {
      await handleLoss();
      return;
    }

    const jitter = 2.0;
    if (proj.along >= lastAlong - jitter) {
      currentAlong = proj.along;
      lastAlong = Math.max(lastAlong, currentAlong);
    } else {
      draw();
      return;
    }

    draw();

    if (currentAlong >= segsInfo.total - END_THRESHOLD) {
      dragging = false;
      try { if (ev.pointerId != null) miss.releasePointerCapture(ev.pointerId); } catch (e) {}
      if (miss) miss.classList.remove("dragging");
      onSuccess();
    }
  }

  async function onUp(ev) {
    if (!dragging || !miss) return;
    dragging = false;
    if (miss) miss.classList.remove("dragging");
    try { if (ev.pointerId != null) miss.releasePointerCapture(ev.pointerId); } catch (e) {}
    if (segsInfo && currentAlong >= segsInfo.total - END_THRESHOLD) {
      onSuccess();
    } else {
      await handleLoss();
    }
  }

  safeRemoveListener(miss, "pointerdown", miss._downHandler);
  safeRemoveListener(window, "pointermove", miss._moveHandler);
  safeRemoveListener(window, "pointerup", miss._upHandler);

  miss._downHandler = onDown;
  miss._moveHandler = onMove;
  miss._upHandler = onUp;

  safeAddListener(miss, "pointerdown", miss._downHandler);
  safeAddListener(window, "pointermove", miss._moveHandler);
  safeAddListener(window, "pointerup", miss._upHandler);

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
    path = generatePathForRound(round);
    segsInfo = computeSegments(path);
    currentAlong = 0;
    lastAlong = 0;
    await animatePreview(path);
    if (path && path.length > 0 && miss) {
      const startP = path[0];
      miss.style.left = (startP.x - missSize.w / 2) + "px";
      miss.style.top = (startP.y - missSize.h / 2) + "px";
    }
    draw();
    enablePrestartMode();
  }, 250);
}

/* ---------------------------
   Hilfsfunktionen
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
    if (rect && rect.width) {
      missSize.w = rect.width;
      missSize.h = rect.height;
    }

    path = generatePathForRound(round);
    segsInfo = computeSegments(path);

    await animatePreview(path);
    if (path && path.length > 0 && miss) {
      const startP = path[0];
      miss.style.left = (startP.x - missSize.w / 2) + "px";
      miss.style.top = (startP.y - missSize.h / 2) + "px";
    }
    draw();
    enablePrestartMode();
  });
}

/* ---------------------------
   Miss image size initialization (wait for load)
   --------------------------- */

function initMissSizeFromImage() {
  if (!miss) return;
  function setSize() {
    const rect = safeGetRect(miss);
    if (rect && rect.width) {
      missSize.w = rect.width;
      missSize.h = rect.height;
    }
  }
  if (miss.complete) {
    setSize();
  } else {
    safeAddListener(miss, 'load', setSize, { once: true });
    setTimeout(setSize, 500);
  }
}
initMissSizeFromImage();

/* ---------------------------
   Initialisierung Highscore + Startzustand
   --------------------------- */

try {
  if (typeof Highscore !== 'undefined' && Highscore && typeof Highscore.init === 'function') {
    Highscore.init({ title: "Highscores", showButton: true, buttonText: "Highscores", attachTo: document.body });
  }
} catch (e) {
  console.warn("Highscore init failed", e);
}

// Erzeuge ersten Pfad und Preview beim Laden
(function initialSetup() {
  path = generatePathForRound(round);
  segsInfo = computeSegments(path);
  if (path && path.length > 0 && miss) {
    const startP = path[0];
    miss.style.left = (startP.x - missSize.w / 2) + "px";
    miss.style.top = (startP.y - missSize.h / 2) + "px";
  } else if (miss) {
    const sx = Math.round(width / 2);
    const sy = Math.round(height * START_Y_FACTOR);
    miss.style.left = (sx - missSize.w / 2) + "px";
    miss.style.top = (sy - missSize.h / 2) + "px";
  }
  draw();
  updateLivesUI();
})();