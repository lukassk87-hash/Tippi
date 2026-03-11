function loadHighscores() {
  const data = localStorage.getItem("highscores");
  return data ? JSON.parse(data) : [];
}

function saveHighscores(list) {
  localStorage.setItem("highscores", JSON.stringify(list));
}

function addHighscore(name, score) {
  let list = loadHighscores();
  list.push({ name, score });
  list.sort((a, b) => b.score - a.score);
  list = list.slice(0, 3);
  saveHighscores(list);
  // Aktualisiere UI, falls sichtbar
  showHighscores();
  renderHighscoreList();
}

function checkForHighscore(score) {
  const list = loadHighscores();
  if (list.length < 3) return true;
  return score > list[list.length - 1].score;
}

/* Rendert die Highscore-Liste in einem Element mit id="highscoreList"
   (z. B. auf der separaten Highscore-Seite). */
function renderHighscoreList() {
  const list = loadHighscores();
  const box = document.getElementById("highscoreList");

  if (!box) return;

  if (list.length === 0) {
    box.innerHTML = "<b>Keine Highscores vorhanden</b>";
  } else {
    box.innerHTML =
      "<b>Top 3 Highscores</b><br><br>" +
      list.map((e, i) => `${i+1}. ${escapeHtml(e.name)}: ${e.score}`).join("<br>");
  }
}

/* Zeigt Highscores im GameOver-Overlay (highscoreBox) und aktualisiert
   die Highscore-Seite (highscoreList) falls vorhanden. */
function showHighscores() {
  const list = loadHighscores();

  // GameOver-Overlay Box (game.js verwendet id="highscoreBox")
  const boxGame = document.getElementById("highscoreBox");
  if (boxGame) {
    if (list.length === 0) {
      boxGame.innerHTML = "<b>Keine Highscores vorhanden</b>";
    } else {
      boxGame.innerHTML =
        "<b>Top 3 Highscores</b><br><br>" +
        list.map((e, i) => `${i+1}. ${escapeHtml(e.name)}: ${e.score}`).join("<br>");
    }
  }

  // Separate Highscore-Seite (id="highscoreList")
  renderHighscoreList();
}

/* Kleine Hilfsfunktion, um HTML-Injection zu vermeiden */
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

/* Beim Laden: rendere die Highscore-Seite, falls vorhanden */
document.addEventListener("DOMContentLoaded", () => {
  renderHighscoreList();
});