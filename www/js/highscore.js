// zu
// Per-game limits: Miss -> top 3, andere Spiele größere Limits
const DEFAULT_GAME_LIMIT = 50;
const GAME_LIMITS = {
  "Miss": 3,
  "Tippi": 50,
  "Ich tippe meinen Päcki": 50
};

function loadHighscores() {
  try {
    const data = localStorage.getItem("highscores");
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn("Highscore load failed, resetting:", e);
    localStorage.removeItem("highscores");
    return [];
  }
}

function saveHighscores(list) {
  localStorage.setItem("highscores", JSON.stringify(list));
}

// Hilfsfunktion: normalisiere Spielnamen konsistent
function normalizeGameName(game) {
  return String(game || "").trim();
}

// Gruppiert, sortiert und kürzt jede Spielgruppe auf das jeweilige Limit.
function enforcePerGameLimits(list) {
  const groups = {};
  for (const e of list) {
    const game = normalizeGameName(e.game);
    if (!groups[game]) groups[game] = [];
    groups[game].push({ name: String(e.name || ""), score: Number(e.score || 0), game });
  }

  const result = [];
  for (const game in groups) {
    groups[game].sort((a, b) => b.score - a.score);
    const limit = GAME_LIMITS.hasOwnProperty(game) ? GAME_LIMITS[game] : DEFAULT_GAME_LIMIT;
    const kept = groups[game].slice(0, limit);
    result.push(...kept);
  }

  result.sort((a, b) => b.score - a.score);
  return result;
}

// Fügt neuen Highscore hinzu und speichert danach die gekürzte Liste
function addHighscore(name, score, game = "Tippi") {
  // einfache Validierung
  const nm = String(name || "Spieler");
  const sc = Number(score || 0);
  const gm = normalizeGameName(game || "Tippi");

  if (!Number.isFinite(sc)) {
    console.warn("Ungültiger Score:", score);
    return;
  }

  const list = loadHighscores();
  list.push({ name: nm, score: sc, game: gm });

  const trimmed = enforcePerGameLimits(list);

  // optional globales Limit
  const globalLimit = 200;
  const finalList = trimmed.slice(0, globalLimit);

  saveHighscores(finalList);

  // Ein Render-Aufruf reicht; rufe die vorhandene Funktion(en) falls vorhanden auf
  if (typeof showHighscores === "function") {
    showHighscores();
  } else if (typeof renderHighscoreList === "function") {
    renderHighscoreList();
  }
}

// Prüft, ob ein Score in die Top-N des Spiels kommt
function checkForHighscore(score, game = "Tippi") {
  const sc = Number(score || 0);
  const gm = normalizeGameName(game || "Tippi");

  const list = loadHighscores().filter(e => normalizeGameName(e.game) === gm);
  list.sort((a, b) => b.score - a.score);
  const limit = GAME_LIMITS.hasOwnProperty(gm) ? GAME_LIMITS[gm] : DEFAULT_GAME_LIMIT;
  if (list.length < limit) return true;
  return sc > list[limit - 1].score;
}

// Render-Funktionen (Beispielimplementierung, anpassbar)
function renderHighscoreList() {
  const list = loadHighscores();
  const box = document.getElementById("highscoreList");
  if (!box) return;

  const groups = {};
  for (const e of list) {
    const g = normalizeGameName(e.game);
    if (!groups[g]) groups[g] = [];
    groups[g].push(e);
  }

  // Reihenfolge der Spiele, die standardmäßig angezeigt werden sollen
  const gamesToShow = ["Tippi", "Ich tippe meinen Päcki", "Miss"];

  let html = "";

  for (const game of gamesToShow) {
    const g = normalizeGameName(game);
    const entries = groups[g] ? groups[g].slice().sort((a, b) => b.score - a.score) : [];
    if (entries.length === 0) continue;

    html += `<section class="highscore-game"><h3>${escapeHtml(g)}</h3><ol>`;
    for (const e of entries) {
      html += `<li><span class="hs-name">${escapeHtml(String(e.name))}</span> <span class="hs-score">${Number(e.score)}</span></li>`;
    }
    html += `</ol></section>`;
  }

  // Falls es noch andere Spiele gibt, die nicht in gamesToShow sind, zeige sie ebenfalls
  for (const game in groups) {
    if (gamesToShow.includes(game)) continue;
    const entries = groups[game].slice().sort((a, b) => b.score - a.score);
    if (entries.length === 0) continue;

    html += `<section class="highscore-game"><h3>${escapeHtml(game)}</h3><ol>`;
    for (const e of entries) {
      html += `<li><span class="hs-name">${escapeHtml(String(e.name))}</span> <span class="hs-score">${Number(e.score)}</span></li>`;
    }
    html += `</ol></section>`;
  }

  box.innerHTML = html;
}

// Einfacher HTML-Escaper für Namen/Texte
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}