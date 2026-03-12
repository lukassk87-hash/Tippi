// js/miss_with_highscore_and_lives.js
// Vollständige Datei: Spiel-Logik + eingebautes Highscore-Modul (localStorage) + 3 Leben.
// Änderungen gegenüber vorheriger Version:
// - Drei Leben (lives = 3). Bei jeder verlorenen Runde wird ein Leben abgezogen.
// - Solange noch Leben übrig sind, wird die aktuelle Runde neu gestartet (keine Highscore‑Abfrage).
// - Wenn alle Leben aufgebraucht sind, erscheint das Highscore‑Overlay (mit Namenseingabe, falls Highscore).
// - Preview läuft mit 50% der ursprünglichen Geschwindigkeit (Dauer verdoppelt).
// - Keine sichtbare Pfadlinie; Wegerkennung: max 50px Abweichung -> Verlust (Leben -1).
// Binde diese Datei in dein HTML ein (z. B. <script src="js/miss_with_highscore_and_lives.js"></script>).

/* =========================
   Highscore Modul (localStorage)
   ========================= */

const Highscore = (function () {
  const STORAGE_KEY = "mygame_highscores_v1";
  const MAX_ENTRIES = 10;

  const OVERLAY_ID = "hsOverlay";
  const DIALOG_ID = "hsDialog";
  const LIST_ID = "hsList";
  const FORM_ID = "hsForm";
  const NAME_INPUT_ID = "hsName";
  const SHOW_BTN_ID = "hsShowBtn";
  const CLEAR_BTN_ID = "hsClearBtn";
  const CLOSE_BTN_ID = "hsCloseBtn";

  let options = {
    title: "Highscores",
    showButton: true,
    buttonText: "Highscores",
    attachTo: document.body
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Highscore: load failed", e);
      return [];
    }
  }

  function save(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("Highscore: save failed", e);
    }
  }

  function addEntry(entry) {
    const list = load();
    list.push(entry);
    list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.ts - a.ts;
    });
    const trimmed = list.slice(0, MAX_ENTRIES);
    save(trimmed);
    return trimmed;
  }

  function isHighscore(score) {
    const list = load();
    if (list.length < MAX_ENTRIES) return true;
    return score > list[list.length - 1].score;
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.position = "fixed";
    overlay.style.left = 0;
    overlay.style.top = 0;
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.display = "none";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = 9999;
    overlay.style.background = "rgba(0,0,0,0.45)";

    const dialog = document.createElement("div");
    dialog.id = DIALOG_ID;
    dialog.style.width = "min(720px, 92%)";
    dialog.style.maxHeight = "86%";
    dialog.style.overflow = "auto";
    dialog.style.background = "#111";
    dialog.style.color = "#fff";
    dialog.style.borderRadius = "8px";
    dialog.style.padding = "18px";
    dialog.style.boxShadow = "0 8px 30px rgba(0,0,0,0.6)";
    dialog.style.fontFamily = "system-ui, sans-serif";

    const title = document.createElement("h2");
    title.textContent = options.title;
    title.style.margin = "0 0 12px 0";
    title.style.fontSize = "20px";

    const list = document.createElement("ol");
    list.id = LIST_ID;
    list.style.paddingLeft = "18px";
    list.style.margin = "8px 0 12px 0";

    const form = document.createElement("form");
    form.id = FORM_ID;
    form.style.display = "none";
    form.style.marginTop = "8px";
    form.innerHTML = `
      <label style="display:block;margin-bottom:6px;font-size:13px">Neuer Highscore! Name:</label>
      <input id="${NAME_INPUT_ID}" type="text" maxlength="20" placeholder="Dein Name" style="padding:8px;border-radius:6px;border:1px solid #333;background:#0f0f0f;color:#fff;width:60%;margin-right:8px" />
      <button type="submit" style="padding:8px 12px;border-radius:6px;border:none;background:#0a84ff;color:#fff">Speichern</button>
    `;

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "8px";
    controls.style.marginTop = "12px";

    const closeBtn = document.createElement("button");
    closeBtn.id = CLOSE_BTN_ID;
    closeBtn.textContent = "Schließen";
    closeBtn.style.padding = "8px 12px";
    closeBtn.style.borderRadius = "6px";
    closeBtn.style.border = "none";
    closeBtn.style.background = "#333";
    closeBtn.style.color = "#fff";

    const clearBtn = document.createElement("button");
    clearBtn.id = CLEAR_BTN_ID;
    clearBtn.textContent = "Alle löschen";
    clearBtn.style.padding = "8px 12px";
    clearBtn.style.borderRadius = "6px";
    clearBtn.style.border = "none";
    clearBtn.style.background = "#7a1f1f";
    clearBtn.style.color = "#fff";

    controls.appendChild(closeBtn);
    controls.appendChild(clearBtn);

    dialog.appendChild(title);
    dialog.appendChild(list);
    dialog.appendChild(form);
    dialog.appendChild(controls);
    overlay.appendChild(dialog);
    options.attachTo.appendChild(overlay);

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      hide();
    });

    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!confirm("Alle Highscores löschen?")) return;
      save([]);
      renderList();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById(NAME_INPUT_ID);
      const name = (input && input.value.trim()) ? input.value.trim() : "Anonym";
      if (lastPendingScore != null) {
        addEntry({ name, score: lastPendingScore, ts: Date.now() });
        lastPendingScore = null;
        form.style.display = "none";
        renderList();
      }
    });
  }

  function show() {
    createOverlay();
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    renderList();
    overlay.style.display = "flex";
  }

  function hide() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.style.display = "none";
  }

  function renderList() {
    const listEl = document.getElementById(LIST_ID);
    if (!listEl) return;
    listEl.innerHTML = "";
    const list = load();
    if (!list || list.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Noch keine Highscores";
      listEl.appendChild(li);
      return;
    }
    list.forEach((e) => {
      const li = document.createElement("li");
      li.style.marginBottom = "6px";
      li.style.fontSize = "15px";
      li.innerHTML = `<strong style="display:inline-block;width:120px">${escapeHtml(e.name)}</strong> <span style="color:#ddd">Runde ${e.score}</span> <span style="color:#888;margin-left:8px;font-size:12px">${formatDate(e.ts)}</span>`;
      listEl.appendChild(li);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  // Wenn ein neuer Highscore erreicht wird, zeigen wir das Formular zur Namenseingabe.
  // record(score) zeigt prompt; recordSilent speichert anonym; recordEndOfGame(score) zeigt Overlay und prompt if needed.
  let lastPendingScore = null;
  function promptForNameIfHighscore(score) {
    if (!isHighscore(score)) return false;
    createOverlay();
    const form = document.getElementById(FORM_ID);
    if (!form) return false;
    lastPendingScore = score;
    form.style.display = "block";
    const input = document.getElementById(NAME_INPUT_ID);
    if (input) {
      input.value = "";
      input.focus();
    }
    show();
    return true;
  }

  function init(opts) {
    options = Object.assign(options, opts || {});
    createOverlay();
    if (options.showButton) {
      if (!document.getElementById(SHOW_BTN_ID)) {
        const btn = document.createElement("button");
        btn.id = SHOW_BTN_ID;
        btn.textContent = options.buttonText || "Highscores";
        btn.style.position = "fixed";
        btn.style.right = "12px";
        btn.style.bottom = "12px";
        btn.style.zIndex = 9998;
        btn.style.padding = "8px 12px";
        btn.style.borderRadius = "8px";
        btn.style.border = "none";
        btn.style.background = "#0a84ff";
        btn.style.color = "#fff";
        btn.style.boxShadow = "0 6px 18px rgba(0,0,0,0.3)";
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          show();
        });
        options.attachTo.appendChild(btn);
      }
    }
  }

  function record(score) {
    // Original behavior: if highscore, prompt for name; otherwise add anonymous if list not full.
    if (typeof score !== "number" || isNaN(score)) return false;
    if (isHighscore(score)) {
      promptForNameIfHighscore(score);
      return true;
    } else {
      const list = load();
      if (list.length < MAX_ENTRIES) {
        addEntry({ name: "Anonym", score, ts: Date.now() });
        return true;
      }
      return false;
    }
  }

  function recordSilent(score) {
    // Speichert den Score direkt ohne Prompt/Overlay. Wenn Platz in Top10, füge anonym ein.
    if (typeof score !== "number" || isNaN(score)) return false;
    const list = load();
    if (isHighscore(score) || list.length < MAX_ENTRIES) {
      addEntry({ name: "Anonym", score, ts: Date.now() });
      return true;
    }
    return false;
  }

  function recordEndOfGame(score) {
    // Wird am Ende des Spiels aufgerufen: zeigt Overlay und erlaubt Namenseingabe, falls Highscore.
    if (typeof score !== "number" || isNaN(score)) return false;
    // If it's a highscore, prompt for name; otherwise still show overlay with list (and optionally add anonymous if list not full)
    if (isHighscore(score)) {
      promptForNameIfHighscore(score);
      return true;
    } else {
      // still add anonymous if list not full
      const list = load();
      if (list.length < MAX_ENTRIES) {
        addEntry({ name: "Anonym", score, ts: Date.now() });
      }
      // show overlay so player can see highscores
      show();
      return true;
    }
  }

  function clear() {
    save([]);
    const listEl = document.getElementById(LIST_ID);
    if (listEl) listEl.innerHTML = "";
  }

  return {
    init,
    record,
    recordSilent,
    recordEndOfGame,
    show,
    clear,
    _internal: { load, save, addEntry }
  };
})();

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