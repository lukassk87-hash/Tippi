
/* =========================
   Spiel-Logik (miss)
   ========================= */

// Canvas / DOM Elemente
const canvas = document.getElementById("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const miss = document.getElementById("miss");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const roundNumEl = document.getElementById("roundNum");

// Lives UI element (erstellt, falls nicht vorhanden)
let lives = 3;
function ensureLivesUI() {
  let el = document.getElementById("livesDisplay");
  if (!el) {
    el = document.createElement("div");
    el.id = "livesDisplay";
    el.style.position = "fixed";
    el.style.left = "12px";
    el.style.bottom = "12px";
    el.style.zIndex = 9998;
    el.style.padding = "8px 12px";
    el.style.borderRadius = "8px";
    el.style.background = "rgba(0,0,0,0.6)";
    el.style.color = "#fff";
    el.style.fontFamily = "system-ui, sans-serif";
    el.style.fontSize = "14px";
    document.body.appendChild(el);
  }
  el.textContent = `Leben: ${lives}`;
}
ensureLivesUI();

// Fallbacks, falls Elemente fehlen
if (!canvas || !miss || !overlay || !startBtn || !roundNumEl) {
  console.warn("Miss game: some DOM elements are missing. Ensure gameCanvas, miss, overlay, startBtn, roundNum exist.");
}

// Spielzustand
let width = 0;
let height = 0;
let path = [];
let segsInfo = null;
let round = 1;

// Einstellungen
const EDGE_MARGIN = 40;
let missSize = { w: 80, h: 80 };
let topQuarterY = 0;
let debug = false;

// Wegerkennung
const MAX_DEVIATION_PX = 50;

let prestartActive = false;
let playing = false;
let dragging = false;
let currentAlong = 0;
let lastAlong = 0;

const PRESTART_EXIT_BUFFER = 8;
const END_THRESHOLD = 6;

// Resize handler
function resizeGame() {
  if (!canvas) return;
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  topQuarterY = Math.round(height * 0.25);

  const rect = miss.getBoundingClientRect();
  if (rect && rect.width) {
    missSize.w = rect.width;
    missSize.h = rect.height;
  }
  draw();
}
window.addEventListener("resize", resizeGame);
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
   Pfad-Generierung (breiter)
   --------------------------- */

function generatePathForRound(r) {
  const nominalStartY = Math.max(EDGE_MARGIN, Math.round(height / 3));
  const targetY = Math.max(nominalStartY + 50, Math.round(height * 0.90));
  const centerX = Math.round(width / 2);

  const curves = Math.min(10, Math.max(0, r - 1));
  const ctrlCount = Math.max(2, curves * 2 + 2);

  const maxLateralHalf = Math.round(width * 0.45);
  const baseAmp = Math.max(40, Math.round(missSize.w * 2.0));
  const ampFactor = 1.0 + Math.min(2.0, r * 0.12);

  const preferredTop = Math.round(height * 0.04);
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
  const { segs, total } = si;
  if (!segs || segs.length === 0) return { x: 0, y: 0 };
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
  const { segs } = si;
  let acc = 0;
  let best = { dist: Infinity, along: 0, point: null };
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
    if (d < best.dist) best = { dist: d, along, point: { x: projX, y: projY } };
    acc += s.len;
  }
  return best;
}

/* ---------------------------
   Preview Animation (50% speed -> duration doubled)
   --------------------------- */

function animatePreview(points) {
  return new Promise(resolve => {
    if (!points || points.length < 2) return resolve();
    segsInfo = computeSegments(points);
    const total = segsInfo.total;

    const base = Math.max(700, Math.min(2200, total * 0.45));
    const PREVIEW_DURATION_MULTIPLIER = 2.0; // Dauer verdoppeln -> halb so schnell
    const duration = base * PREVIEW_DURATION_MULTIPLIER;

    const startTime = performance.now();

    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const dist = t * total;
      const p = pointAtDistance(segsInfo, dist);
      miss.style.left = (p.x - missSize.w / 2) + "px";
      miss.style.top = (p.y - missSize.h / 2) + "px";
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
    miss.style.left = (startP.x - missSize.w / 2) + "px";
    miss.style.top = (startP.y - missSize.h / 2) + "px";
    requestAnimationFrame(step);
  });
}

/* ---------------------------
   Draw (Canvas bleibt leer; miss DOM bewegt)
   --------------------------- */

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  // Keine Pfadlinien, keine Marker. Canvas bleibt leer.
}

/* ---------------------------
   Leben / Verlustbehandlung
   - Drei Leben; bei Verlust: lives--.
   - Wenn noch Leben übrig: aktuelle Runde neu starten (Vorschau + Prestart).
   - Wenn keine Leben mehr: Ende des Spiels -> Highscore-Overlay (mit Namenseingabe falls Highscore), Reset auf Runde 1 und lives zurücksetzen.
   --------------------------- */

function updateLivesUI() {
  const el = document.getElementById("livesDisplay");
  if (el) el.textContent = `Leben: ${lives}`;
}

async function handleLoss() {
  flash("red");
  // kurz warten, damit Flash sichtbar ist
  await new Promise(res => setTimeout(res, 250));

  lives = Math.max(0, lives - 1);
  updateLivesUI();

  if (lives > 0) {
    // Spieler hat noch Leben: restart same round (no highscore)
    // keep current round number, regenerate path and preview
    path = generatePathForRound(round);
    segsInfo = computeSegments(path);
    currentAlong = 0;
    lastAlong = 0;
    await animatePreview(path);
    if (path && path.length > 0) {
      const startP = path[0];
      miss.style.left = (startP.x - missSize.w / 2) + "px";
      miss.style.top = (startP.y - missSize.h / 2) + "px";
    }
    draw();
    enablePrestartMode();
    return;
  }

  // lives == 0 -> Ende des Spiels
  // Zeige Highscore-Overlay und erlaub Name-Eingabe falls Highscore
  try {
    Highscore.recordEndOfGame(round);
  } catch (e) {
    console.warn("Highscore.recordEndOfGame failed", e);
  }

  // Reset game state: round -> 1, lives reset
  round = 1;
  lives = 3;
  updateLivesUI();
  roundNumEl.textContent = round;

  path = generatePathForRound(round);
  segsInfo = computeSegments(path);
  currentAlong = 0;
  lastAlong = 0;
  await animatePreview(path);
  if (path && path.length > 0) {
    const startP = path[0];
    miss.style.left = (startP.x - missSize.w / 2) + "px";
    miss.style.top = (startP.y - missSize.h / 2) + "px";
  }
  draw();
  enablePrestartMode();
}

/* ---------------------------
   Prestart
   --------------------------- */

function enablePrestartMode() {
  prestartActive = true;
  playing = false;
  dragging = false;

  if (path && path.length > 0) {
    const startP = path[0];
    miss.style.left = (startP.x - missSize.w / 2) + "px";
    miss.style.top = (startP.y - missSize.h / 2) + "px";
  } else {
    const sx = Math.round(width / 2);
    const sy = Math.round(height * 0.04);
    miss.style.left = (sx - missSize.w / 2) + "px";
    miss.style.top = (sy - missSize.h / 2) + "px";
  }

  miss.style.touchAction = "none";
  miss.style.pointerEvents = "auto";

  function onDown(ev) {
    ev.preventDefault();
    dragging = true;
    miss.classList.add("dragging");
    try { miss.setPointerCapture(ev.pointerId); } catch (e) {}
  }

  function onMove(ev) {
    if (!dragging) return;
    let x = ev.clientX;
    let y = ev.clientY;
    x = Math.max(missSize.w / 2, Math.min(width - missSize.w / 2, x));
    y = Math.max(missSize.h / 2, Math.min(height - missSize.h / 2, y));
    miss.style.left = (x - missSize.w / 2) + "px";
    miss.style.top = (y - missSize.h / 2) + "px";
  }

  function onUp(ev) {
    if (!dragging) return;
    dragging = false;
    miss.classList.remove("dragging");
    try { miss.releasePointerCapture(ev.pointerId); } catch (e) {}

    const rect = miss.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const midX = rect.left + rect.width / 2;

    if (midY > topQuarterY - PRESTART_EXIT_BUFFER) {
      if (!path || path.length < 2) return;
      segsInfo = computeSegments(path);
      const proj = projectPointOnPath(segsInfo, { x: midX, y: midY });

      // Prüfe Abweichung beim Übergang
      if (proj.dist > MAX_DEVIATION_PX) {
        handleLoss();
        return;
      }

      prestartActive = false;
      startEvaluationMode(proj);
      return;
    }
  }

  miss.removeEventListener("pointerdown", miss._preDown);
  window.removeEventListener("pointermove", miss._preMove);
  window.removeEventListener("pointerup", miss._preUp);

  miss._preDown = onDown;
  miss._preMove = onMove;
  miss._preUp = onUp;

  miss.addEventListener("pointerdown", miss._preDown);
  window.addEventListener("pointermove", miss._preMove);
  window.addEventListener("pointerup", miss._preUp);

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
    miss.style.left = (pos.x - missSize.w / 2) + "px";
    miss.style.top = (pos.y - missSize.h / 2) + "px";
  } else {
    currentAlong = 0;
    lastAlong = 0;
    const startP = pointAtDistance(segsInfo, 0);
    miss.style.left = (startP.x - missSize.w / 2) + "px";
    miss.style.top = (startP.y - missSize.h / 2) + "px";
  }

  miss.style.touchAction = "none";
  miss.style.pointerEvents = "auto";

  function onDown(ev) {
    ev.preventDefault();
    dragging = true;
    miss.classList.add("dragging");
    try { miss.setPointerCapture(ev.pointerId); } catch (e) {}
  }

  function onMove(ev) {
    if (!dragging) return;
    let x = ev.clientX;
    let y = ev.clientY;
    x = Math.max(missSize.w / 2, Math.min(width - missSize.w / 2, x));
    y = Math.max(missSize.h / 2, Math.min(height - missSize.h / 2, y));
    miss.style.left = (x - missSize.w / 2) + "px";
    miss.style.top = (y - missSize.h / 2) + "px";

    const proj = projectPointOnPath(segsInfo, { x, y });

    // Wegerkennung: wenn Finger zu weit weg, Runde verloren -> Leben abziehen / Ende prüfen
    if (proj.dist > MAX_DEVIATION_PX) {
      handleLoss();
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
      try { miss.releasePointerCapture(ev.pointerId); } catch (e) {}
      miss.classList.remove("dragging");

      // Completed round: advance to next round (no highscore here)
      onSuccess();
    }
  }

  function onUp(ev) {
    if (!dragging) return;
    dragging = false;
    miss.classList.remove("dragging");
    try { miss.releasePointerCapture(ev.pointerId); } catch (e) {}
    if (segsInfo && currentAlong >= segsInfo.total - END_THRESHOLD) {
      onSuccess();
    } else {
      // Losgelassen bevor Ziel erreicht -> Verlust
      handleLoss();
    }
  }

  miss.removeEventListener("pointerdown", miss._downHandler);
  window.removeEventListener("pointermove", miss._moveHandler);
  window.removeEventListener("pointerup", miss._upHandler);

  miss._downHandler = onDown;
  miss._moveHandler = onMove;
  miss._upHandler = onUp;

  miss.addEventListener("pointerdown", miss._downHandler);
  window.addEventListener("pointermove", miss._moveHandler);
  window.addEventListener("pointerup", miss._upHandler);

  draw();
}

/* ---------------------------
   Erfolg / nächste Runde
   --------------------------- */

function onSuccess() {
  flash("green");
  setTimeout(async () => {
    round++;
    roundNumEl.textContent = round;
    path = generatePathForRound(round);
    segsInfo = computeSegments(path);
    currentAlong = 0;
    lastAlong = 0;
    await animatePreview(path);
    if (path && path.length > 0) {
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
    const rect = miss.getBoundingClientRect();
    if (rect && rect.width) {
      missSize.w = rect.width;
      missSize.h = rect.height;
    }

    path = generatePathForRound(round);
    segsInfo = computeSegments(path);

    await animatePreview(path);
    if (path && path.length > 0) {
      const startP = path[0];
      miss.style.left = (startP.x - missSize.w / 2) + "px";
      miss.style.top = (startP.y - missSize.h / 2) + "px";
    }
    draw();
    enablePrestartMode();
  });
}

/* ---------------------------
   Initialisierung Highscore + Startzustand
   --------------------------- */

// Highscore UI initialisieren (Button rechts unten)
try {
  Highscore.init({ title: "Highscores", showButton: true, buttonText: "Highscores", attachTo: document.body });
} catch (e) {
  console.warn("Highscore init failed", e);
}

// Erzeuge ersten Pfad und Preview beim Laden, falls gewünscht
(function initialSetup() {
  path = generatePathForRound(round);
  segsInfo = computeSegments(path);
  // setze miss auf Startposition (sichtbar)
  if (path && path.length > 0) {
    const startP = path[0];
    miss.style.left = (startP.x - missSize.w / 2) + "px";
    miss.style.top = (startP.y - missSize.h / 2) + "px";
  }
  draw();
  updateLivesUI();
})();