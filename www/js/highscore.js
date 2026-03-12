/* highscore.js
   Erweiterung: Highscore-Einträge enthalten jetzt {name, score, game}
   Funktionen:
   - loadHighscores(), saveHighscores()
   - addHighscore(name, score, game = "Tippi")
   - checkForHighscore(score, game = "Tippi")
   - renderHighscoreList() zeigt separate Abschnitte für beide Spiele
   - showHighscores() aktualisiert highscoreBox (falls vorhanden) und Liste
*/

function loadHighscores() {
  const data = localStorage.getItem("highscores");
  return data ? JSON.parse(data) : [];
}

function saveHighscores(list) {
  localStorage.setItem("highscores", JSON.stringify(list));
}

// name: string, score: number, game: string (optional)
function addHighscore(name, score, game = "Tippi") {
  let list = loadHighscores();
  list.push({ name: String(name), score: Number(score), game: String(game) });
  // sort global by score desc
  list.sort((a, b) => b.score - a.score);
  // keep reasonable length (e.g., top 50 overall)
  list = list.slice(0, 50);
  saveHighscores(list);
  showHighscores();
  renderHighscoreList();
}

// check if score is a highscore for given game (top 3 for that game)
function checkForHighscore(score, game = "Tippi") {
  const list = loadHighscores().filter(e => e.game === game);
  // sort descending by score to reliably get top positions
  list.sort((a, b) => b.score - a.score);
  if (list.length < 3) return true;
  // compare with the 3rd best (index 2)
  return score > list[2].score;
}

// render the highscore list into #highscoreList (used on highscore.html)
function renderHighscoreList() {
  const list = loadHighscores();
  const box = document.getElementById("highscoreList");
  if (!box) return;

  // group by game
  const groups = {};
  for (const e of list) {
    if (!groups[e.game]) groups[e.game] = [];
    groups[e.game].push(e);
  }

  // ensure both games appear even if empty
  const gamesToShow = ["Tippi", "Ich tippe meinen Päcki"];
  let html = "";

  for (const g of gamesToShow) {
    const arr = groups[g] ? groups[g].slice() : [];
    // sort each group's entries by score desc
    arr.sort((a, b) => b.score - a.score);
    const top = arr.slice(0, 3);
    html += <div class="hs-game"><b>${escapeHtml(g)}</b><br>;
    if (top.length === 0) {
      html += "Keine Highscores vorhanden<br><br>";
    } else {
      html += top.map((e, i) => ${i+1}. ${escapeHtml(e.name)}: ${e.score}).join("<br>") + "<br><br>";
    }
    html += </div>;
  }

  box.innerHTML = html;
}

// showHighscores updates the in-game highscore box (if present) and the highscore page list
function showHighscores() {
  const list = loadHighscores();

  const boxGame = document.getElementById("highscoreBox");
  if (boxGame) {
    // show compact summary: best per game
    const games = ["Tippi", "Ich tippe meinen Päcki"];
    let html = "";
    for (const g of games) {
      const arr = list.filter(e => e.game === g).sort((a,b)=>b.score-a.score).slice(0,3);
      html += <div><b>${escapeHtml(g)}</b>: ;
      if (arr.length === 0) html += "—";
      else html += arr.map((e,i)=>${i+1}. ${escapeHtml(e.name)} (${e.score})).join("; ");
      html += </div>;
    }
    boxGame.innerHTML = html;
  }

  // also update highscore page list if present
  renderHighscoreList();
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m];
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderHighscoreList();
});
