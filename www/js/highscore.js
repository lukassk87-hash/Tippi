const DEFAULT_GAME_LIMIT = 10;
const GAME_LIMITS = {
  "Miss": 3,
  "Tippi": 10,
  "Ich tippe meinen Päcki": 10,
  "Tico geht angeln": 10
};

function loadHighscores() {
  try {
    const data = localStorage.getItem("highscores");
    const parsed = data ? JSON.parse(data) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeHighscoreEntry) : [];
  } catch (e) {
    console.warn("Highscore load failed, resetting:", e);
    localStorage.removeItem("highscores");
    return [];
  }
}

function saveHighscores(list) {
  localStorage.setItem("highscores", JSON.stringify(list));
}

function normalizeGameName(game) {
  return String(game || "").trim();
}

function normalizeHighscoreEntry(entry) {
  const score = Number(entry?.score || 0);

  return {
    name: String(entry?.name || "Spieler"),
    score: Number.isFinite(score) ? score : 0,
    game: normalizeGameName(entry?.game),
    fishName: String(entry?.fishName || ""),
    fishLength: String(entry?.fishLength || ""),
    fishWeight: String(entry?.fishWeight || "")
  };
}

function getGameLimit(game) {
  return Object.prototype.hasOwnProperty.call(GAME_LIMITS, game)
    ? GAME_LIMITS[game]
    : DEFAULT_GAME_LIMIT;
}

function enforcePerGameLimits(list) {
  const groups = {};

  for (const rawEntry of list) {
    const entry = normalizeHighscoreEntry(rawEntry);
    const game = entry.game;

    if (!groups[game]) {
      groups[game] = [];
    }

    groups[game].push(entry);
  }

  const result = [];

  for (const game in groups) {
    groups[game].sort((a, b) => b.score - a.score);
    const limit = getGameLimit(game);
    result.push(...groups[game].slice(0, limit));
  }

  result.sort((a, b) => b.score - a.score);
  return result;
}

function addHighscore(name, score, game = "Tippi", extra = null) {
  const nm = String(name || "Spieler").trim() || "Spieler";
  const sc = Number(score || 0);
  const gm = normalizeGameName(game || "Tippi");

  if (!Number.isFinite(sc)) {
    console.warn("Ungültiger Score:", score);
    return;
  }

  const entry = {
    name: nm,
    score: sc,
    game: gm
  };

  if (gm === "Tico geht angeln" && extra) {
    entry.fishName = String(extra.fishName || "");
    entry.fishLength = String(extra.fishLength || "");
    entry.fishWeight = String(extra.fishWeight || "");
  }

  const list = loadHighscores();
  list.push(entry);

  const trimmed = enforcePerGameLimits(list);
  const globalLimit = 200;
  const finalList = trimmed.slice(0, globalLimit);

  saveHighscores(finalList);

  if (typeof showHighscores === "function") {
    showHighscores();
  } else if (typeof renderHighscoreList === "function") {
    renderHighscoreList();
  }
}

function checkForHighscore(score, game = "Tippi") {
  const sc = Number(score || 0);
  const gm = normalizeGameName(game || "Tippi");

  if (!Number.isFinite(sc)) {
    return false;
  }

  const list = loadHighscores()
    .filter((entry) => normalizeGameName(entry.game) === gm)
    .sort((a, b) => b.score - a.score);

  const limit = getGameLimit(gm);

  if (list.length < limit) {
    return true;
  }

  return sc > list[limit - 1].score;
}

function renderHighscoreList() {
  const list = loadHighscores();
  const box = document.getElementById("highscoreList");

  if (!box) {
    return;
  }

  const groups = {};
  for (const rawEntry of list) {
    const entry = normalizeHighscoreEntry(rawEntry);
    const game = normalizeGameName(entry.game);

    if (!groups[game]) {
      groups[game] = [];
    }

    groups[game].push(entry);
  }

  const gamesToShow = [
    "Tippi",
    "Ich tippe meinen Päcki",
    "Miss",
    "Tico geht angeln"
  ];

  let html = "";

  for (const game of gamesToShow) {
    const g = normalizeGameName(game);
    const entries = groups[g] ? groups[g].slice().sort((a, b) => b.score - a.score) : [];

    if (entries.length === 0) {
      continue;
    }

    html += `<section class="highscore-game"><h3>${escapeHtml(g)}</h3><ol>`;

    for (const e of entries) {
      if (g === "Tico geht angeln") {
        html += `
          <li>
            <span class="hs-name">${escapeHtml(e.name)}</span>
            <span class="hs-meta">
              ${escapeHtml(e.fishName || "-")}
              · ${escapeHtml(e.fishLength || "-")}
              · ${escapeHtml(e.fishWeight || "-")}
            </span>
          </li>
        `;
      } else {
        html += `
          <li>
            <span class="hs-name">${escapeHtml(e.name)}</span>
            <span class="hs-score">${Number(e.score)}</span>
          </li>
        `;
      }
    }

    html += `</ol></section>`;
  }

  for (const game in groups) {
    if (gamesToShow.includes(game)) {
      continue;
    }

    const entries = groups[game].slice().sort((a, b) => b.score - a.score);

    if (entries.length === 0) {
      continue;
    }

    html += `<section class="highscore-game"><h3>${escapeHtml(game)}</h3><ol>`;

    for (const e of entries) {
      html += `
        <li>
          <span class="hs-name">${escapeHtml(e.name)}</span>
          <span class="hs-score">${Number(e.score)}</span>
        </li>
      `;
    }

    html += `</ol></section>`;
  }

  box.innerHTML = html;
}

function showHighscores() {
  renderHighscoreList();
}

function clearHighscores() {
  localStorage.removeItem("highscores");
  renderHighscoreList();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}