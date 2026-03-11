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
}

function checkForHighscore(score) {
  const list = loadHighscores();
  if (list.length < 3) return true;
  return score > list[list.length - 1].score;
}

function renderHighscoreList() {
  const list = loadHighscores();
  const box = document.getElementById("highscoreList");

  if (!box) return;

  if (list.length === 0) {
    box.innerHTML = "<b>Keine Highscores vorhanden</b>";
  } else {
    box.innerHTML =
      "<b>Top 3 Highscores</b><br><br>" +
      list.map((e, i) => `${i+1}. ${e.name}: ${e.score}`).join("<br>");
  }
}

renderHighscoreList();