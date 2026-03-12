// highscore.js
// Per-game limits: Miss -> top 3, andere Spiele größere Limits
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

// Gruppiert, sortiert und kürzt jede Spielgruppe auf das jeweilige Limit.
function enforcePerGameLimits(list) {
  const groups = {};
  for (const e of list) {
    const game = String(e.game || ""); // defensive
    if (!groups[game]) groups[game] = [];
    groups[game].push({ name: String(e.name || ""), score: Number(e.score || 0), game });
  }

  const result = [];
  for (const game in groups) {
    groups[game].sort((a, b) => b.score - a.score);
    const limit = GAME_LIMITS.hasOwnProperty(game) ? GAME_LIMITS[game] : 50;
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
  const gm = String(game || "Tippi");

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
  if (typeof showHighscores === "function") showHighscores();
  if (typeof renderHighscoreList === "function") renderHighscoreList();
}

// Prüft, ob ein Score in die Top-N des Spiels kommt
function checkForHighscore(score, game = "Tippi") {
  const sc = Number(score || 0);
  const list = loadHighscores().filter(e => e.game === game);
  list.sort((a, b) => b.score - a.score);
  const limit = GAME_LIMITS.hasOwnProperty(game) ? GAME_LIMITS[game] : 3;
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
    if (!groups[e.game]) groups[e.game] = [];
    groups[e.game].push(e);
  }

  const gamesToShow = ["Tippi", "Ich tippe meinen Päcki", "Miss"];
  let html = "";